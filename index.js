const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  // console.log(authorization);
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    // console.log(decoded);
    req.decoded = decoded; // just next e pass korar jonno
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bs8dc9c.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("combatDB").collection("users");
    const topSliderCollection = client.db("combatDB").collection("topslider");
    const popularClassCollection = client
      .db("combatDB")
      .collection("popularclass");
    const instructorCollection = client.db("combatDB").collection("instructor");
    const selectedClassCollection = client.db("combatDB").collection("selectedclass")
    //jwt

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // users related api

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email",async(req,res)=>{
      const {email} = req.params
      // console.log(email);
      const query = {email : email}
      const result = await usersCollection.findOne(query)
      res.send(result)
    })

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user?.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already existed" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // top slider api

    app.get("/topslider", async (req, res) => {
      const result = await topSliderCollection.find().toArray();
      res.send(result);
    });

    // popular class

    app.get("/popularclass", async (req, res) => {
      const result = await popularClassCollection.find().toArray();
      res.send(result);
    });
    // selectedclass
    app.get("/selectedclass",async(req,res)=>{
      const {email} = req.query
      const result = await selectedClassCollection.find({email}).toArray()
      res.send(result)
    })
    app.get("/selectedclass/:id",async(req,res)=>{
      const id = req.params.id;
      if(id){
        const filter = {_id:new ObjectId(id)}
        
        const result = await selectedClassCollection.findOne(filter)
        res.send(result)
      }
  
    })
    app.post("/selectedclass",async(req,res)=>{
      const selectedClass = req.body;
      // console.log(selectedClass);
      const result = await selectedClassCollection.insertOne(selectedClass)
      res.send(result)
    })
    app.delete("/selectedclass/:id",async(req,res)=>{
      const id = req.params.id;
      // console.log(id);
      const filter = {_id:new ObjectId(id)}
      const result = await selectedClassCollection.deleteOne(filter)
      res.send(result)
    })
    // instructor api
    app.get("/instructor", async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });


    // check student 

    app.get("/users/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ student: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = {
        student: user?.role === "student",
      };
      res.send(result);
    });


    // payment related api 

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      // console.log(price);
      const amount = parseInt(price * 100);
      // console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("combat server is running");
});

app.listen(port, () => {
  console.log(`combat server port : ${port}`);
});
