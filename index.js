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
    const selectedClassCollection = client
      .db("combatDB")
      .collection("selectedclass");
    const paymentCollection = client.db("combatDB").collection("payments");
    const enrolledClassesCollection = client
      .db("combatDB")
      .collection("enrolledclass");

    const paymentHistoryCollection = client
      .db("combatDB")
      .collection("payments");
    const addedClassesByInstructorCollection = client
      .db("combatDB")
      .collection("addedclass");
    // admin route
    app.get("/allclasses", async (req, res) => {
      const result = await addedClassesByInstructorCollection.find().toArray();
      res.send(result);
    });
    app.put("/allclasses/:id", async (req, res) => {
      const id = req.params.id;
      const card = req.body;
      const filter = { _id: new ObjectId(id) };
      const doc = {
        insertedId: id,
        image: card.image,
        martialArtName: card.martialArtName,
        instructorName: card.instructorName,
        studentsEnrolled: card.studentsEnrolled,
        price: card.price,
      };
      // console.log(doc);
      const updatedClass = {
        $set: {
          status: card.click,
        },
      };
      const options = { upsert: true };
      if (card.click == "denied") {
        const result = await addedClassesByInstructorCollection.updateOne(
          filter,
          updatedClass,
          options
        );
        return res.send({ result });
      } else {
        const insertResult = await popularClassCollection.insertOne(doc);
        const result = await addedClassesByInstructorCollection.updateOne(
          filter,
          updatedClass,
          options
        );
        return res.send({ result, insertResult });
      }
    });

    // admin feedback

    app.put("/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const feedback = req.body;
      const filter = { _id: new ObjectId(id) };
      // console.log(feedback);
      const updatedClass = {
        $set: {
          feedback: feedback.feedback,
        },
      };
      const options = { upsert: true };

      const result = await addedClassesByInstructorCollection.updateOne(
        filter,
        updatedClass,
        options
      );
      return res.send(result);
    });

    app.get("/allusers", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/checkuser", async (req, res) => {
      const email = req.query;
      // console.log(email);
      const result = await usersCollection.findOne(email);
      res.send(result);
    });

    app.put("/allusers/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { role } = req.body;
      // console.log(role,id);
      const updateUser = {
        $set: {
          role: role,
        },
      };
      const options = { upsert: true };
      const updateResult = await usersCollection.updateOne(
        filter,
        updateUser,
        options
      );
      res.send(updateResult);
    });

    // add class by instructor api
    app.get("/myclass", async (req, res) => {
      const {email} = req.query;
      const query = {
        instructorEmail : email
      }
      const result = await addedClassesByInstructorCollection
        .find( query )
        .toArray();
      res.send(result);
    });

    app.post("/addclass", async (req, res) => {
      const addedClass = req.body;
      // console.log(addedClass);
      const result = await addedClassesByInstructorCollection.insertOne(
        addedClass
      );
      res.send(result);
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role != "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

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

    app.get("/users/:email", async (req, res) => {
      const { email } = req.params;
      // console.log(email);
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });
    //checking user is student or not
    app.get("/users/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ student: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = {
        user: user?.role === "student",
      };
      res.send(result);
    });
    // checking instructor or not
    app.get(
      "/users/instructor/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        if (req.decoded.email !== email) {
          res.send({ instructor: false });
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const result = {
          user: user?.role === "instructor",
        };
        res.send(result);
      }
    );
    // checking admin or not
    app.get("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = {
        user: user?.role === "admin",
      };
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);
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
    app.get("/selectedclass", async (req, res) => {
      const { email } = req.query;
      const result = await selectedClassCollection.find({ email }).toArray();
      res.send(result);
    });
    app.get("/selectedclass/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      if (id) {
        const filter = { _id: new ObjectId(id) };
        const result = await selectedClassCollection.findOne(filter);
        res.send(result);
      }
    });
    app.post("/selectedclass", async (req, res) => {
      const selectedClass = req.body;
      // console.log(selectedClass);
      const result = await selectedClassCollection.insertOne(selectedClass);
      res.send(result);
    });
    app.delete("/selectedclass/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(filter);
      res.send(result);
    });
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

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const email = payment.email;
      const selectedId = payment.selectedId;
      const enrollId = payment.enrollId;
      payment.studentsEnrolled=parseInt(payment.studentsEnrolled)+1
      const enrollFilter = { _id: new ObjectId(enrollId) };
      const findResult = await popularClassCollection.findOne(enrollFilter);
      findResult.email = email;
      delete findResult._id;
      // console.log(findResult);
      const addedClassFilter = { _id: new ObjectId(findResult.insertedId) }
      const enrolledClassResult = await enrolledClassesCollection.insertOne(
        findResult
      );
      const EnrollStudent = findResult.studentsEnrolled;
      const updateClass = {
        $set: {
          studentsEnrolled: EnrollStudent + 1,
        },
      };
      const options = { upsert: true };
      const updatedResult = await popularClassCollection.updateOne(
        enrollFilter,
        updateClass,
        options
      );
      const addedClassUpdateResult = await addedClassesByInstructorCollection.updateOne(
        addedClassFilter,
        updateClass,
        options
      );
      const filter = { _id: new ObjectId(selectedId) };
      const deleteResult = await selectedClassCollection.deleteOne(filter);
      const insertResult = await paymentCollection.insertOne(payment);
      
      res.send({
        findResult,
        enrolledClassResult,
        updatedResult,
        deleteResult,
        insertResult,
        addedClassUpdateResult
      });
    });

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

    // enrolled class

    app.get("/enrolledclass", async (req, res) => {
      const { email } = req.query;
      const result = await enrolledClassesCollection.find({ email }).toArray();
      res.send(result);
    });
    // payment history
    app.get("/paymenthistory", async (req, res) => {
      const { email } = req.query;
      const result = await paymentHistoryCollection.find({ email }).toArray();

      res.send(result);
    });
    //
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
