const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const stripe = require("stripe")('process.env.STRIPE_SECRET')

const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

     
// const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@morshed.wlvmmza.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}


async function run() {
    try {
        const appointmentOptionCollection = client.db('Doctor').collection('appointmentOptions');
        const bookingsCollection = client.db('Doctor').collection('bookings');
        const usersCollection = client.db('Doctor').collection('users');
        const DoctorsCollection = client.db('Doctor').collection('doctors');
        const PaymentCollection = client.db('Doctor').collection('payment');



        const verifyAdmin =  async (req,res, next ) => {

            console.log("inside verifyAdmin", req.decoded.email)
            const decodedEmail = req.decoded.email;
            const query = {email : decodedEmail}
            const user = await usersCollection.findOne(query)
            if(user?.role !== 'admin'){

                return res.status(403).send({message :'forbidden acces '})
            }
            next();
        }


      


        // Use Aggregate to query multiple collection and then merge data
        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            console.log(date)
            const query = {};
            const options = await appointmentOptionCollection.find(query).toArray();
            // get the bookings of the provided date
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
            // code carefully :D
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
                const bookedSlots = optionBooked.map(book => book.slot);
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots;
            })
            res.send(options);
        });


        /***
         * API Naming Convention 
         * app.get('/bookings')
         * app.get('/bookings/:id')
         * app.post('/bookings')
         * app.patch('/bookings/:id')
         * app.delete('/bookings/:id')
        */

        app.get('/appointmentSpecialty', async(req,res) => {
            const query = { }
            const result = await appointmentOptionCollection.find(query).project({name : 1}).toArray();
            res.send(result);
        })
        app.get('/bookings',verifyJWT, async (req,res) => {

            const email = req.query.email;

            const decodedEmail = req.decoded.email;

            if(email !== decodedEmail){
                return res.status(403).send({message : 'forbidden access '})
            }

            const query = {email : email};
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);



        })



        app.post('/bookings', async(req,res) => {
            
            const booking = req.body;
            const query = {
                appointmentDate :booking.appointmentDate,
                email : booking.email,
                treatment : booking.treatment
            }
            const alreadyBooked= await  bookingsCollection.find(query).toArray();


         if(alreadyBooked.length){
            const message = `You already have a booking on ${booking.appointmentDate}`
            return res.send({acknowledged : false, message});
         }
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        })

    


        app.get('/users', async(req,res) => {

            const query = {};

            const users = await usersCollection.find(query).toArray();

            res.send(users);
            


        })

        app.post('/users', async(req,res) => {
            const user = req.body;
            console.log(user);
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })


        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '10d' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });



        app.get('/users/admin/:email', async(req,res) => {
            const email = req.params.email;
            const query = {email}
            const user = await usersCollection.findOne(query);
            res.send({isAdmin : user?.role === 'admin'});
        })





        app.put('/users/admin/:id', verifyJWT, verifyAdmin,  async(req,res) => {

          

            const id = req.params.id;
            const filter = { _id : new ObjectId(id)};
            const options = {upsert : true}
            const updatedDoc = {
                $set : {
                    role : 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter,updatedDoc,options)
            res.send(result);
        })


        app.get('/doctors',verifyJWT, verifyAdmin, async(req,res) => {

            const query = {}
            const doctors = await DoctorsCollection.find(query).toArray();
            res.send(doctors);

        })


        app.post('/doctors',verifyJWT, verifyAdmin, async(req,res) => {
            const doctor = req.body;
            const result = await DoctorsCollection.insertOne(doctor);
            res.send(result);
        })




        app.delete('/doctors/:id', async(req,res) => {
            const id = req.params.id;
            const filter = { _id : new ObjectId(id)}
            const result = await DoctorsCollection.deleteOne(filter);
            res.send(result);
        })    

        app.post('http://localhost:5000//create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });
          


/* IF DONT GIVE / INFRONT DATA IS NOT FOUND  */
        app.get('/bookings/:id', async(req,res) => {
            const id = req.params.id;
            const query = { _id : new ObjectId(id)};
            const booking = await bookingsCollection.findOne(query);
            res.send(booking);
        })


        // app.get('/bookings/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: ObjectId(id) };
        //     const booking = await bookingsCollection.findOne(query);
        //     res.send(booking);
        // })


        // add price section to mongodb

        // app.get('/addPrice', async(req,res) => {

        //     const filter = { }

        //     const options = {upsert : true}

        //     const updatedDoc = {

        //         $set : {

        //             price : 99
        //         }
        //     }

        //     const result =  await  appointmentOptionCollection.updateMany(filter, updatedDoc,options);
        //     res.send(result)

        // })


        app.post('/payments', async(req,res) => {
            const payment = req.body;
            const result = await PaymentCollection.insertOne(payment);
            const id = payment.bookingId;
            const filter = {_id : ObjectId(id)}
            const updatedDoc = {
                $set : {
                    paid : true,
                    transactionId : payment.transactionId
                }
            }
            const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc);
            

            res.send(result)


        })




    }
    finally {

    }
}
run().catch(console.log);

app.get('/', async (req, res) => {
    res.send('doctors portal server is running');
})

app.listen(port, () => console.log(`Doctors portal running on ${port}`))
