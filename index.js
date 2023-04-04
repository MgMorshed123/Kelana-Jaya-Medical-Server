
const express = require('express');

const cors = require('cors')

const port = process.env.PORT || 5000;

const app = express()
require('dotenv').config();


app.use(cors())
app.use(express.json())


// morshed10
// Bxl7wmJGeEW7uTd3




     
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@morshed.wlvmmza.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });




   async function run(){

       try{

        const appointmentOptionCollection =client.db('Doctor').collection('Services')

        const bookingCollection = client.db('Doctor').collection('bookings')

        app.get('/services', async (req,res) => {


              const date = req.query.date;
              const query = {}
              const options = await appointmentOptionCollection.find(query).toArray();
              const bookingQuery = {appointmentDate : date}
              const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();
              
              options.forEach(option => {
              const optionBooked = alreadyBooked.filter(book => book.treatment ===  option.name)
              const bookedSlots = optionBooked.map(book => book.slot)

              console.log( bookedSlots)

              const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))

              option.slots = remainingSlots;


              // console.log(date, option.name, "bookedSlots", bookedSlots.length, "remainingr",remainingSlots.length );

           })

           res.send(options)           
        })

        app.post('/bookings', async(req,res) => {
         const booking = req.body;
        //  console.log(booking)


        const query ={

          appointmentDate : booking.appointmentDate,

          treatment : booking.treatment,

          email : booking.email,
          


        }

        const alreadyBooked = await bookingCollection.find(query).toArray()


        if(alreadyBooked.length){

          const message = `you have a booking on ${booking.appointmentDate}`

          return res.send({acknowledged : false, message})


          
        }

         const result = await bookingCollection.insertOne(booking);
         res.send(result);
        })
       } 
       
       finally{

       }

   }

   run().catch(console.log("first"))





   app.get('/', async(req,res) => {

    res.send(`Doctors  portal running on ${port}`);

   })


   app.listen(port, () => console.log(`Doctors Portal Running on ${port}`))
