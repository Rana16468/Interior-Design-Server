const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const port = 5001;
const cors = require("cors");
require("dotenv").config();
const SSLCommerzPayment = require("sslcommerz-lts");
const {
  get_all_data,
  post_data,
  specific_data,
  update_data,
  delete_data,
} = require("./Common/ResuableMethod");

const { upload, sendImageToCloudinary } = require("./Common/ImageGenerator");

// test database

const uri = `mongodb+srv://mdashifuzzamanakib:3bRzKAo50fZS5nWE@cluster0.xdg34sp.mongodb.net/I_Design?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//midileware

app.use(cors());
app.use(express.json());

//ssl commerz functionality
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWORD;
const is_live = false; //true for live, false for sandbox

// console.log(store_id);
// console.log(store_passwd);

async function run() {
  const productCollection = client.db("InteriorDesign").collection("IDesign");
  const categoriesCollections = client
    .db("InteriorDesign")
    .collection("ICategories");
  const bookingCollections = client.db("InteriorDesign").collection("booking");
  const reportCollections = client.db("InteriorDesign").collection("report");
  const paymentCollections = client.db("InteriorDesign").collection("payment");
  const wishListCollections = client
    .db("InteriorDesign")
    .collection("wishlist");
  const userCollections = client.db("InteriorDesign").collection("user");

  try {
    app.get("/", (req, res) => {
      res
        .status(200)
        .json({ status: true, message: "Interior Design Final Year Project" });
    });

    app.post("/order", async (req, res) => {
      const productData = req.body;
      const tran_id = new Date().getTime();
      const data = {
        total_amount: productData.price,
        currency: productData?.currency,
        tran_id: tran_id, // use unique tran_id for each api call
        success_url: `http://localhost:5001/payment/success/${tran_id}`,
        fail_url: `http://localhost:5001/payment/fail/${tran_id}`,
        cancel_url: "http://localhost:5001/cancel",
        ipn_url: "http://localhost:5001/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: productData?.UserName,
        cus_email: productData?.email,
        cus_add1: productData?.address,
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: productData?.phoneNumber,
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: "10",
        ship_country: "Bangladesh",
      };

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      // store database ---->  transactionID
      const finalOrder = {
        ...productData,
        paidStatus: false,
        transactionID: tran_id,
        date: new Date().toString(),
      };

      const result = post_data(paymentCollections, finalOrder);
      result
        .then((result) => {
          return;
        })
        .catch((error) => {
          console.log(error?.message);
        });

      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });
        //  console.log('Redirecting to: ', GatewayPageURL)
      });
    });
    //  payment Success Method
    app.post("/payment/success/:tranId", async (req, res) => {
      // if payment successfull then
      const tranId = req.params.tranId;
      const query = {
        transactionID: Number(tranId),
      };
      const updateDoc = {
        $set: {
          paidStatus: true,
        },
      };

      const successResult = await paymentCollections.updateOne(
        query,
        updateDoc,
        {
          upsert: true,
        }
      );

      // added status infromation booking collections
      const findPaymentInfo = specific_data(paymentCollections, query);
      findPaymentInfo
        .then((result) => {
          console.log(result.id);
          // update booking information list
          const update_booking = update_data(
            result.id,
            { transactionID: req.params.tranId, paidStatus: true },
            bookingCollections
          );
          update_booking
            .then((result) => {})
            .catch((error) => {
              console.log(error?.message);
            });
        })
        .catch((error) => {
          console.log(error?.message);
        });

      // booking status and transaction updated

      if (successResult.modifiedCount > 0) {
        return res.redirect(
          `http://localhost:3000/payment/success/${req.params.tranId}`
        );
      }
    });

    app.post("/payment/fail/:tranId", async (req, res) => {
      const tranId = req.params.tranId;
      const query = {
        transactionID: Number(tranId),
      };
      const result = await paymentCollections.deleteOne(query);
      if (result.acknowledged) {
        return res.redirect(
          `http://localhost:3000/payment/fail/${req.params.tranId}`
        );
      }
    });

    // get all Interior design  Catagories
    app.get("/getInterior_design_categories", async (req, res) => {
      const query = {};
      const allCategories = get_all_data(productCollection, query);
      allCategories
        .then((result) => {
          return res.status(200).send({
            status: true,
            messsage: "Successfully Retrieve All Categories Data",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // added the product

    app.post("/added_interior_categories", async (req, res) => {
      const data = req.body;
      const post_categories = post_data(productCollection, data);
      post_categories
        .then((result) => {
          return res.status(201).send({
            status: true,
            messsage: "Successfully Create Categories",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // get design categories
    app.get("/design_categories", async (req, res) => {
      const { email } = req.query;

      const query = {
        email: email,
      };
      const categories = get_all_data(productCollection, query);
      categories
        .then((result) => {
          return res.status(200).send({
            status: true,
            messsage: "Successfully Find Categories",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // post catagories data specificly

    app.post("/upload", upload.array("photo"), async (req, res) => {
      const { formData } = req.body; // text data
      const data = JSON.parse(formData);

      // convert json data
      const randomNumber = Math.floor(Math.random() * 100) + 1; //random number geberator
      const imgName = "image";
      const uploadPromises = req.files.map(async (file, index) => {
        const imageName = `${imgName.trim()}${randomNumber + index + 1}`;
        const imageUrl = await sendImageToCloudinary(imageName, file.path);
        return imageUrl?.secure_url;
      });

      try {
        const imageList = await Promise.all(uploadPromises);
        const categoriesDetails = post_data(categoriesCollections, {
          data,
          imageList,
        });
        categoriesDetails
          .then((result) => {
            res.status(201).send({
              status: true,
              messsage: "Successfully Create Categories Details",
              data: result,
            });
          })
          .catch((error) => {
            console.log(error);
          });
      } catch (error) {
        console.error("Error occurred:", error);
        throw new Error(error?.message); // Re-throw the error for handling at a higher level
      }
    });

    // image generator to using openai

    app.get("/aiImage", async (req, res) => {
      // image genaration

      const generate = await openai.createImage({
        prompt: "A dog playing the violant",
        n: 1,
        size: "512x512",
      });
      const image = generate.data.data[0].url;
      console.log(image);
    });

    //categories-details

    app.get("/categories-details/:id", async (req, res) => {
      const { id } = req.params;
      const query = {
        "data.categories": id,
      };
      const categoriesDetails = get_all_data(categoriesCollections, query);
      categoriesDetails
        .then((result) => {
          res.status(200).send({
            status: true,
            messsage: "Successfully Rectrive Categories Details",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });
    //SpecificCategoriesDetails

    app.get("/SpecificCategoriesDetails/:id", async (req, res) => {
      const { id } = req.params;
      const query = new ObjectId(id);
      const specificCategoriesDetails = specific_data(
        categoriesCollections,
        query
      );
      specificCategoriesDetails
        .then((result) => {
          res.status(200).send({
            status: true,
            messsage: "Successfully Single Rectrive Categories Details",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // update specific categories details
    app.put("/update_specific_categories_details/:id", async (req, res) => {
      const { id } = req.params;
      const updateInfo = req.body;
      Reflect.deleteProperty(updateInfo, "term");

      const {
        categories,
        name,
        email,
        price,
        date,
        sellerName,
        discription,
        imageList,
      } = updateInfo;

      const data = {
        categories,
        name,
        email,
        price,
        date,
        sellerName,
        discription,
      };
      const sendData = {
        data,
        imageList,
      };

      const updateSpecific_design = update_data(
        id,
        sendData,
        categoriesCollections
      );
      updateSpecific_design
        .then((result) => {
          return res
            .status(200)
            .send({ status: true, message: "Successfully Updated", result });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // delete  specific categories details

    app.delete("/delete_specific_categories_details/:id", async (req, res) => {
      const { id } = req.params;
      const delete_specific_dettails = delete_data(id, categoriesCollections);
      delete_specific_dettails
        .then((result) => {
          res.status(200).send({
            status: true,
            message: "Successfully Deleted",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // delete only categories
    app.delete("/delete-categories/:id", async (req, res) => {
      const { id } = req.params;

      const filter = {
        "data.categories": id,
      };

      const delete_categoriesdetails = await categoriesCollections.deleteMany(
        filter
      );

      if (delete_categoriesdetails.deletedCount > 0) {
        const delete_specific_dettails = delete_data(id, productCollection);
        delete_specific_dettails
          .then((result) => {
            res.status(200).send({
              status: true,
              message: "Successfully Deleted",
              data: result,
            });
          })
          .catch((error) => {
            console.log(error?.message);
          });
      }
    });

    // speciific cantegory update

    app.get("/specificCategory/:id", async (req, res) => {
      const { id } = req.params;
      const query = new ObjectId(id);
      const specific_category = specific_data(productCollection, query);
      specific_category
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfully Rectrive",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // update only category

    app.put("/update_category/:id", async (req, res) => {
      const { id } = req.params;
      const sendData = req.body;

      const updateSpecific_design = update_data(
        id,
        sendData,
        productCollection
      );
      updateSpecific_design
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfully Updated",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // booking data
    app.post("/booking_details", async (req, res) => {
      const data = req.body;
      const booking_details = post_data(bookingCollections, data);
      booking_details
        .then((result) => {
          return res.status(201).send({
            status: true,
            message: "Booking Successfully Done",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error.message);
        });
    });

    //get booking list
    app.get("/booking_list", async (req, res) => {
      const { email } = req.query;
      const query = {
        email,
      };
      const bookingList = get_all_data(bookingCollections, query);
      bookingList
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfully Identify the Booking data",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // booking infromation

    app.get("/specificBookingInfo/:id", async (req, res) => {
      const { id } = req.params;
      const query = new ObjectId(id);
      const bookingInformation = specific_data(bookingCollections, query);
      bookingInformation
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfully Rectrive",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // update booking infromation
    app.put("/update_booking/:id", async (req, res) => {
      const { id } = req.params;
      const data = req.body;

      const update_booking = update_data(id, data, bookingCollections);
      update_booking
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfully Updated",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // delete booking list

    app.delete("/delete_bookinglist/:id", async (req, res) => {
      const { id } = req.params;
      const isItPaid = await bookingCollections.findOne({
        _id: new ObjectId(id),
      });
      if (isItPaid?.transactionID && isItPaid?.paidStatus) {
        return res
          .status(400)
          .send({ message: "Payment Already Done Is Can Not Deteleable" });
      }

      const delete_bookinglist = delete_data(id, bookingCollections);
      delete_bookinglist
        .then((result) => {
          res.status(200).send({
            status: true,
            message: "Successfully Deleted",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // get All Booking List

    app.get("/all_booking_list", async (req, res) => {
      const query = {};
      const all_bookingList = get_all_data(bookingCollections, query);
      all_bookingList
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "All Booking Successfully Rectrive",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // report poasting

    app.post("/report_details", async (req, res) => {
      const data = req.body;

      const report_details = post_data(reportCollections, data);
      report_details
        .then((result) => {
          return res.status(201).send({
            status: true,
            message: "Successfully Recorded",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // wishList
    app.put("/set_wishList/:id", async (req, res) => {
      const { id } = req.params;
      const data = req.body;

      const wishList = update_data(id, data, wishListCollections);
      wishList
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfully Added WishList",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // get wishList

    app.get("/get_wishList", async (req, res) => {
      const query = {
        email: req.query.email,
      };
      const result = get_all_data(wishListCollections, query);
      result
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfuly Rectrive the WishList",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // delete wish list
    app.delete("/delete-wishList/:id", async (req, res) => {
      const { id } = req.params;

      const deleteWishList = delete_data(id, wishListCollections);
      deleteWishList
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfully Delete WishList",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    app.get("/my_buyerlist", async (req, res) => {
      const { email } = req.query;

      const query = {
        sellerEmail: email,
      };

      const buyer_list = get_all_data(bookingCollections, query);
      buyer_list
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfully Rectrive BuyerAccount",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // specific TransactionReport
    app.get("/specificTransactionReport/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const query = {
        id,
      };

      const specifc_transactionReport = specific_data(
        paymentCollections,
        query
      );

      specifc_transactionReport
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successdully Rectrive Transaction Data",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // update price Information
    app.put("/update_paymentInfo/:id", async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const update_paymentInfo = update_data(id, data, paymentCollections);
      update_paymentInfo
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfully Updated",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // chnage Account Status
    app.put("/chnage_Account_Status/:id", async (req, res) => {
      const { id } = req.params;
      const data = req.body;

      const changeStatus = update_data(id, data, bookingCollections);
      changeStatus
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfully Chnage Status",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // stote user Information
    app.post("/storeUserInformation", async (req, res) => {
      const data = req.body;

      Reflect.deleteProperty(data, "password");
      Reflect.deleteProperty(data, "term");
      Reflect.deleteProperty(data, "confirmpassword");
      const userData = { role: false, data };
      const user_information = post_data(userCollections, userData);
      user_information
        .then((result) => {
          return res.status(201).send({
            status: true,
            message: "Successfuly Store User Information",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;

      const query = { email: email };
      const result = await userCollections.findOne(query);

      res.status(200).send({ Admin: result?.role });
    });

    // get all payment list

    app.get("/all_payment_list", async (req, res) => {
      const query = {};
      const paymentList = get_all_data(paymentCollections, query);
      paymentList
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    //delete paymment list
    app.delete("/delete_payment/:id", async (req, res) => {
      const { id } = req.params;

      const query = { _id: new ObjectId(id) };
      const TransactionId = await paymentCollections.findOne(query);
      const filter = {
        _id: new ObjectId(TransactionId?.id),
      };
      const updateDoc = {
        $unset: { paidStatus: 1, transactionID: 1 },
      };
      const bookingInfoDeleted = await bookingCollections.updateOne(
        filter,
        updateDoc,
        { upsert: true }
      );
      if (bookingInfoDeleted.modifiedCount > 0) {
        const delete_payment = delete_data(id, paymentCollections);
        delete_payment
          .then((result) => {
            return res.status(200).send({
              status: true,
              message: "Successfuly Deleted",
              data: result,
            });
          })
          .catch((error) => {
            console.log(error?.message);
          });
      } else {
        const delete_payment = delete_data(id, paymentCollections);
        delete_payment
          .then((result) => {
            return res.status(200).send({
              status: true,
              message: "Successfuly Deleted",
              data: result,
            });
          })
          .catch((error) => {
            console.log(error?.message);
          });
      }
    });

    // user wish list

    app.get("/all_wish_list", async (req, res) => {
      const query = {};
      const all_wish_list = get_all_data(wishListCollections, query);
      all_wish_list
        .then((result) => {
          return res
            .status(200)
            .send({ status: true, message: "", data: result });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    app.get("/all_reports_list", async (req, res) => {
      const query = {};
      const all_report_list = get_all_data(reportCollections, query);
      all_report_list
        .then((result) => {
          return res
            .status(200)
            .send({ status: true, message: "", data: result });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });
    // delete report

    app.delete("/delete_report/:id", async (req, res) => {
      const { id } = req.params;

      const delete_report = delete_data(id, reportCollections);
      delete_report
        .then((result) => {
          return res.status(200).send({
            status: true,
            message: "Successfully Resolve",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // all user list

    app.get("/all_user_list", async (req, res) => {
      const query = {};
      const all_users = get_all_data(userCollections, query);
      all_users
        .then((result) => {
          return res
            .status(200)
            .send({ status: true, message: "", data: result });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    // chnage Admin status
    app.put("/chnage_Admin_Status/:id", async (req, res) => {
      const { id } = req.params;

      const role = req.body;
      // checked seller Account
      const isItSellerAccount = await userCollections.findOne({
        _id: new ObjectId(id),
      });

      if (isItSellerAccount?.userCategory === "Seller Account") {
        const filter = {
          _id: new ObjectId(id),
        };
        const updateDoc = {
          $set: role,
        };
        const result = await userCollections.updateOne(filter, updateDoc, {
          upsert: true,
        });

        if (result?.modifiedCount > 0) {
          return res.status(200).send({
            status: true,
            message: "Successfully Created Admin",
            data: result,
          });
        } else {
          return res.status(200).send({
            status: true,
            message: "Only Seller Account Can be play Admin Roll",
            data: result,
          });
        }
      } else {
        console.log("");
      }
    });

    // user Profile
    app.get("/user_profile", async (req, res) => {
      const { email } = req.query;
      const query = { email };
      const specific_user_profile = specific_data(userCollections, query);
      specific_user_profile.then((result) => {
        return res
          .status(200)
          .send({ status: true, message: "", data: result });
      });
    });

    // update User Profile
    app.put("/update_userProfile/:id", async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const updateProfileInfo = update_data(id, data, userCollections);
      updateProfileInfo
        .then((result) => {
          return res.status(200).send({
            success: true,
            message: "Successfully Updated",
            data: result,
          });
        })
        .catch((error) => {
          console.log(error?.message);
        });
    });

    //payment Faild Method
  } finally {
  }
}
run().catch((error) => {
  console.log(error.messsage);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});