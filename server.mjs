import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { fork } from 'child_process';
// import session from "express-session";
// import MongoDBSessionStore from "connect-mongodb-session";
// import MongoStore from "connect-mongo";
import multer from "multer";
// import MemoryStore from "memorystore";
import axios from 'axios';
import path from "path";
import { fileURLToPath } from "url";
// import cryptoRandomString from "crypto-random-string";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import cors from "cors";
import fs from "fs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import  moment from 'moment';
// import bcrypt from "bcryptjs";
// New routes to catagorize our routes into diferent folder and file
import otpRoutes from "./client-Dashboard/server/routes/regOtpGenerationRoutes.js"; // Import the OTP routes

// imported new to manage notification routes easily from the client dashboard 19 july 2024
import notificationRoutes from './client-Dashboard/server/routes/notificationRoutes.js';

import { sendAcceptNotificationToUser, sendRejectNotificationToUser, sendLoginOtpNotificationToUser } from './client-Dashboard/server/Controllers/notificationController.js'; // Import the function

import UserData from "./client-Dashboard/server/models/UserData.js";

import { getEmailFooter, getEmailHeader } from "./client-Dashboard/server/utils/emailTemplate.js";

import { getEmailRejectedTemplate } from './client-Dashboard/server/utils/emailRejectedTemplates.js'; // Import the function

import OTP from "./client-Dashboard/server/models/otpModel.js";

import AcceptedUser from "./client-Dashboard/server/models/AcceptedUser.js";
import EnquiryData from "./client-Dashboard/server/models/EnquiryDataUser.js"


import adminApp from './admin-dashboard/server/index.js'; // Import the admin app

import clientApp from './client-Dashboard/server/index.js'; // Import the admin app


// new imports to make my sessiom and mongodb connections in a separate folder and file to make my main server.mjs file more manageble
import { connectDB } from './client-Dashboard/server/config/db.js';
import { configureSession } from './client-Dashboard/server/Middleware/session.js';
import { adminSessionMiddleware } from './admin-dashboard/server/middleware/adminSession.js';
import { authenticate } from './client-Dashboard/server/Middleware/authenticate.js';
import staticFiles from './client-Dashboard/server/routes/staticFiles.js';

import userDataRouter from './client-Dashboard/server/routes/userData.js';
import Subscription from './client-Dashboard/server/models/subscriptionModel.js';

import headerandnavigation  from "./routes/header-navigation.js"


import { checkConnections } from './dbstats.js';

import NodeCache from 'node-cache';

// mongoose.connect(
//   "mongodb+srv://adarshtripathi:5DiDFt8UHHtlMRNT@cluster0.evumy2h.mongodb.net/",
//   { useNewUrlParser: true, useUnifiedTopology: true }
// );
dotenv.config();

// Here, 604800 seconds equals 7 days. Adjust TTL as necessary.
const tokenCache = new NodeCache({ stdTTL: 604800 });

const isChild = process.argv.includes('--child');

// ----- PARENT PROCESS: MONITOR AND RESTART -----
if (!isChild) {
  const startChild = () => {
    console.log('Starting server child process...');
    // Fork a new child using the current file with the "--child" flag.
    const child = fork(process.argv[1], ['--child'], {
      cwd: process.cwd(),
      execArgv: [] // No additional Node arguments
    });

    // Listen for the exit event on the child process.
    child.on('exit', (code) => {
      console.error(`Server child process exited with code ${code}. Restarting in 5 seconds...`);
      setTimeout(startChild, 5000);
    });
  };

  // Start the child process (monitor branch).
  startChild();
} else {

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

// app.get('/sw.js', (req, res) => {
//   res.sendFile(path.join(__dirname, 'sw.js'));
// });

// app.use("/uploads", express.static(path.join(__dirname, "public", "uploads"))); 

// const uploadDir = path.join(__dirname, "public", "uploads");


// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir);
// }

// Delay the server start until after the database connection is established
const startServer = async () => {
  try {
    await connectDB(); // Ensure the database connection is established

    // Your existing middleware and routes
    configureSession(app);
    // configureAdminSession(app);

    app.use(staticFiles);
    app.set('trust proxy', true);
// const MongoDBStore = MongoDBSessionStore(session);

// const store = new MongoDBStore({
//   uri: "mongodb+srv://adarshtripathi:5DiDFt8UHHtlMRNT@cluster0.evumy2h.mongodb.net/",
//   collection: "sessions",
//   expires: 1000 * 60 * 60 * 24 * 7, // 1 week
// });

// store.on("error", function (error) {
//   console.error("Session store error:", error);
// });



// const isProduction = process.env.NODE_ENV === "production";

// const sessionOptions = {
//   secret: process.env.SESSION_SECRET,
//   cookie: {
//     httpOnly: true,
//     secure: isProduction, // Use secure cookies in production
//     sameSite: isProduction ? "none" : "lax",
//   },
//   resave: false,
//   saveUninitialized: false,
//   store: store,
// };

// app.use(session(sessionOptions));

// app.use((req, res, next) => {
//   console.log("Session data:", req.session);
//   next();
// });

// app.set('trust proxy', true);  

// function authenticate(req, res, next) {
//   console.log("Session user:", req.session.user);
//   if (req.session.user) {
//     next();
//   } else {
//     res.redirect("/account-center/signin-identifier");
//   }
// }


app.use(bodyParser.urlencoded({ extended: true }));

app.use(bodyParser.json());

const corsOptions = {
  origin: [
    "https://foxxbioprocess.myshopify.com",
    "https://foxxbioprocess.myshopify.com/pages/custom-sut-tets",
    "https://foxx-bio-process-custom-sut-catelogue.onrender.com",
    "https://foxx-bio-process-custom-sut-catelogue.onrender.com/uas/portal/auth/login",
    "https://foxx-bio-process-custom-sut-catelogue.onrender.com/verify-passkey",
    "https://www.foxxlifesciences.com",
    "http://127.0.0.1:5500",
    "http://localhost:10000/",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Middleware to check if request is coming from an allowed origin

const port = process.env.PORT || 10000;

// Load Google service account credentials
const credentials = JSON.parse(fs.readFileSync("credentials.json"));

// Initialize Google Sheets API
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });

// Create transporter using your company's SMTP server settings
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587, // Port 587 is recommended
  secure: false, // TLS/StartTLS enabled
  auth: {
    user: process.env.EMAIL, // Your company email address
    pass: process.env.PASSWORD, // Your company email password
  },
});



function validateEmail(email) {
  const regex = /\S+@\S+\.\S+/;
  return regex.test(email);
}

const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error:"));



app.use("/generate-otp", otpRoutes); // Use the OTP routes

app.use("/header-and-navigation",  headerandnavigation); // Use the OTP routes


app.use('/notifications', notificationRoutes);

const FormDataSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
  jobTitle: String,
  company: String,
  department: String,
  streetAddress: String,
  postalCode: String,
  selectedCountry: String,
  selectedState: String,
  phoneNumber: String
});
const FormDataModel = mongoose.model('FormData', FormDataSchema);


// created new 
const checkRegistrationStatus = async (req, res, next) => {
  const email = req.body.email; // Assuming email is sent in the request body

  try {
      const existingUser = await UserData.findOne({ email: email });

      if (existingUser) {
          // User exists, deny access and send access denied page
          res.sendFile(path.join(__dirname, 'public', 'access-denied', 'verify-otp-access-denied-model.html'));
      } else {
          // User does not exist, allow access to verification page
          next();
      }
  } catch (error) {
      console.error('Error checking registration status:', error);
      res.status(500).send('Error checking registration status.');
  }
};

// Endpoint to check registration status
app.get('/check-registration-status', async (req, res) => {
  const { email } = req.query;

  try {
      const existingUser = await UserData.findOne({ email: email });

      if (existingUser) {
          res.status(200).json({ registered: true });
      } else {
          res.status(200).json({ registered: false });
      }
  } catch (error) {
      console.error('Error checking registration status:', error);
      res.status(500).send('Error checking registration status.');
  }
});

const checkReferrer = (req, res, next) => {
  const referrer = req.headers.referer;

  // Check if the request is coming from the expected referrer
  if (referrer && referrer.endsWith('/identity/account/registration')) {
    // Store a session variable indicating access
    req.session.allowedAccess = true;
    next(); // If referrer is from /identity/account/registration, proceed
  } else {
    // Clear the session and disallow access
    req.session.allowedAccess = false;
    next(); // Proceed to next middleware
  }
};

const checkEmailInDatabase = async (req, res, next) => {
  const email = req.body.email; // Assuming email is sent in the request body

  try {
    // Check if the email exists in the database
    const existingUser = await UserData.findOne({ email: email });

    if (existingUser) {
      // If the user exists, deny access and send access denied page
      res.sendFile(path.join(__dirname, 'public', 'access-denied', 'verify-otp-access-denied-model.html'));
    } else {
      // If the user does not exist, proceed to the next middleware
      next();
    }
  } catch (error) {
    console.error('Error checking email in database:', error);
    res.status(500).send('Error checking email in database.');
  }
};

// Middleware to check session for access
/* 
const checkSession = (req, res, next) => {
  if (req.session.allowedAccess) {
    // Session allows access, clear the session and disallow future access
    req.session.allowedAccess = false;
    next();
  } else {
    // No access, send access denied page
    res.sendFile(path.join(__dirname, 'public', 'access-denied', 'verify-otp-access-denied-model.html'));
  }
};

*/

const checkConfirmation = (req, res, next) => {
  const referrer = req.headers.referer;

  // Check if the request is coming from the expected referrer
  if (referrer && referrer.endsWith('/identity/auth-ui/email/verify')) {
    // Check if the user has confirmed registration
    if (req.session.confirmedRegistration) {
      next(); // User has confirmed registration, proceed
    } else {
      res.sendFile(path.join(__dirname, 'public', 'access-denied', 'verify-otp-access-denied-model.html'));
    }
  } else {
    next(); // Proceed to next middleware
  }
};

app.post('/identity/auth-ui/email/verify', checkConfirmation, checkEmailInDatabase, checkReferrer, checkRegistrationStatus ,async (req, res) => {
  try {
    const formData = req.body;

    // Save form data to MongoDB
    const newFormData = new FormDataModel(formData);
    await newFormData.save();

     res.sendFile(path.join(__dirname, 'public', 'verify-otp-registration.html'));
  } catch (error) {
    console.error('Error saving form data:', error);
    res.status(500).send('Error saving form data.');
  }
});

// Route to serve verify-otp-registration.html
app.get('/identity/auth-ui/email/verify', checkReferrer, checkConfirmation, checkEmailInDatabase, checkRegistrationStatus, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify-otp-registration.html'));
});


// Route to serve verify-otp-registration.html
app.get('/identity/auth-ui/email/verify/data', async (req, res) => {
  try {
      const formData = await FormDataModel.findOne().sort({ _id: -1 }).exec();
      res.json(formData);
      console.log("Server send form data", formData)
  } catch (error) {
      console.error('Error fetching form data:', error);
      res.status(500).send('Error fetching form data.');
  }
});

// Route to serve verify-otp-registration.html

// Verify OTP
// Modify OTP verification logic to redirect upon successful verification
// Verify OTP
// Verify OTP for register
app.post("/verify-otp", async (req, res) => {
  try {
    const enteredOTP = req.body.otp;
    const email = req.body.email;


    const otpRecord = await OTP.findOne({ email: email }).sort({ createdAt: -1 });

    // Log the retrieved OTP record for debugging
    //console.log("Retrieved OTP Record:", otpRecord);

    if (!otpRecord) {
     // console.log("OTP not found for the provided email.");
      res.status(400).send("OTP not found for the provided email.");
      return;
    }

    const storedOTP = otpRecord.otp;
    const expiresAt = otpRecord.expiresAt;

    // Check if OTP has expired
    if (expiresAt < new Date()) {
     // console.log("OTP has expired.");
      res.status(400).send("OTP has expired. Please regenerate OTP.");
      return;
    }

    if (enteredOTP === storedOTP) {
     // console.log("OTP verified successfully.");
      res.send("OTP verified successfully. You can proceed with registration.");

      // Remove the OTP record from the database


      // Send a success email
      const successMailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Email Verification Successful for Custom Sut Catalog",
        html: `
          ${getEmailHeader()}
          <div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
            <div style="background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px 0px rgba(0,0,0,0.1);">
              <hr style="border: 1px solid #ddd;">
              <p style="color: #585d6a; font-size: 16px;">Dear User,</p>
              <p style="color: #585d6a; font-size: 16px;">Your one-time verification code has been successfully verified. You can now proceed with the registration process.</p>
              <hr style="border: 1px solid #ddd;">
              <p style="color: #777; font-size: 12px; text-align: center;">This email was sent automatically. Please do not reply.</p>
              <p style="color: #777; font-size: 12px; text-align: center;">Timestamp: ${new Date().toLocaleString()}</p>
            </div>
          </div>
          ${getEmailFooter()}
        `,
      };

      await transporter.sendMail(successMailOptions);
    } else {
      console.log("Invalid OTP.");
      res.status(400).send("Invalid OTP");
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).send("Failed to verify OTP.");
  }
});

// app.post("/check-otp-generated", async (req, res) => {
//   try {
//     const { email } = req.body;


//     const otpRecord = await OTP.findOne({ email: email });

//     if (otpRecord) {
//       console.log("OTP already generated for the provided email.");
//       res.status(200).send("OTP already generated for the provided email.");
//     } else {
//       console.log("No OTP generated for the provided email.");
//       res.status(404).send("No OTP generated for the provided email.");
//     }
//   } catch (error) {
//     console.error("Error checking OTP:", error);
//     res.status(500).send("Failed to check OTP.");
//   }
// });

// function generateToken() {
//   return crypto.randomBytes(20).toString("hex"); // Generate a 40-character random token
// }


// Endpoint to check if email exists or not
app.get("/check-email", async (req, res) => {
  const email = req.query.email;

  try {
    const user = await UserData.findOne({ email });
    if (user) {
      res.json({ exists: true });
    } else {
      res.json({ exists: false });
    }

  } catch (err) {
    console.error("Error checking email:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Express route for handling form submission
app.post("/register", async (req, res) => {
  try {
    const userData = req.body;
    userData.registrationDate = new Date();


      // Fetch the form data to get the email
      const formData = await FormDataModel.findOne().sort({ _id: -1 }).exec();
      if (!formData) {
        throw new Error('Form data not found.');
      }

      // Delete the form data record after registration
      await FormDataModel.findByIdAndDelete(formData._id);

    // Validate email address
    if (!validateEmail(userData.email)) {
      return res.status(400).send("Invalid email address");
    }

    // Fetch the latest registration ID from the Google Sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Sheet1!A2:A", // Assuming registration IDs start from cell A2
    });

    let latestRegistrationId = 0;
    if (response.data.values && response.data.values.length > 0) {
      const latestRegistrationIdStr =
        response.data.values[response.data.values.length - 1][0];
      latestRegistrationId = parseInt(
        latestRegistrationIdStr.match(/\d{4}$/)[0]
      ); // Update regex here
    }

    // Increment the numeric part of the latest registration ID
    const nextRegistrationId = String(latestRegistrationId + 1).padStart(
      4,
      "0"
    );

    // Generate the next registration ID
    const registrationId = `FOXXBIOPROCESSCUSTOMSUT24${nextRegistrationId}`;
    userData.registrationId = registrationId; // Add registration ID to userData

    // Save user data to MongoDB
    await UserData.create(userData);

    // Get current date and time
    const registrationDate = new Date().toLocaleString();

    // Add registrationDate to userData with the correct key
    userData["Data & Time"] = registrationDate;

    // Send confirmation email to the user
    const userMailOptions = {
      from: process.env.EMAIL,
      to: userData.email,
      subject:
        "Registration Confirmation for Foxx Bioprocess Custom SUT Catalog",
      html: `
            Foxx Bioprocess Custom SUT Catalog confirmation email
            ${getEmailHeader()}
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgb(247, 247, 247);">
                    <tbody><tr style="height: 60px;" height="60">
                        <td>
                            <div style="margin: 15px 48px;">
                                <span style="font-family: HelveticaNeue-Light, Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 300; line-height: 28px; color: rgb(34, 34, 34); vertical-align: middle; display: table-cell;">
                                    We’ve received your registration for <span>Foxx Bioprocess Custom SUT Catalog</span>
                                </span>
                            </div>
                        </td>
                    </tr>
                </tbody></table>
                <table style="width: 100%; max-width:600px;margin:0 auto; font-family: Arial, sans-serif; border-collapse: collapse;">
                <tr>
                <td style="padding: 20px; padding-left:0px; text-align: left;">
                <p>Dear, <strong>${
                  userData.firstName
                }</strong>&nbsp;<strong>${
                  userData.lastName
                }</strong> </p>
                  <p style="font-size: 16px; color: #585d6a; line-height: 1.5; padding-bottom:10px">
                    Thank you for registering on <span style="font-weight: bold;">foxxbioprocess.com</span>.
                    You have successfully registered as a user.
                  </p>
                  <p style="font-size: 16px; color: #585d6a; line-height: 1.5;padding-bottom:20px;">
                    Now you can wait for your application approval. When your application is approved by our team, you will receive an email notification on your registered email ID.
                  </p>
                  <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin-top: 20px;margin-bottom:20px">
                  <tr>
                      <td bgcolor="#007bff" style="border-radius: 4px;">
                          <a href="https://custom-sut-catalog.foxxbioprocess.com/identity/account/registration/confirmation" style="padding: 10px 20px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block;" target="_blank">Application Status</a>
                      </td>
                  </tr>
              </table>
                  <p style="font-size: 16px; color: #585d6a; font-weight:900; line-height: 1.5;">
                    Once approved, you can:
                  </p>
                  <ul style="list-style-type: none; padding: 0; font-size: 16px; color: #585d6a;">
                    <li style="padding: 5px 0;">&#8226; Access to 1000+ Customer Facing Diagrams Sets</li>
                    <li style="padding: 5px 0;">&#8226; Customize your SUT</li>
                    <li style="padding: 5px 0;">&#8226; Enquiry Support</li>
                    <li style="padding: 5px 0;">&#8226; Access to other material</li>
                  </ul>
                </td>
              </tr>
            </table>
            <table border="1" cellpadding="5" style="width: 100%; max-width:600px;margin:0 auto; font-family: Arial, sans-serif; border-collapse: collapse;">
            <hr style="border: 1px solid #ddd; max-width:600px;margin:0 auto;">
            <p style="padding:20px;padding-left:0px; max-width:600px;margin:0 auto;">Here are your registration details:</p>
                <tr>
                    <td>Registration ID:</td>
                    <td><strong>${registrationId}</strong></td>
                </tr>
                <tr>
                    <td>First Name:</td>
                    <td><strong>${userData.firstName}</strong></td>
                </tr>
                <tr>
                    <td>Last Name:</td>
                    <td><strong>${userData.lastName}</strong></td>
                </tr>
                <tr>
                    <td>Job Title:</td>
                    <td><strong>${userData.jobTitle}</strong></td>
                </tr>
                <tr>
                    <td>Company or University:</td>
                    <td><strong>${userData.company}</strong></td>
                </tr>
                <tr>
                    <td>Department:</td>
                    <td><strong>${userData.department}</strong></td>
                </tr>
                <tr>
                    <td>Street Address:</td>
                    <td><strong>${userData.streetAddress}</strong></td>
                </tr>
                <tr>
                    <td>Zip Code/Postal Code:</td>
                    <td><strong>${userData.postalCode}</strong></td>
                </tr>
                <tr>
                    <td>Country:</td>
                    <td><strong>${userData.selectedCountry}</strong></td>
                </tr>
                <tr>
                    <td>State:</td>
                    <td><strong>${userData.selectedState}</strong></td>
                </tr>
                <tr>
                    <td>Phone Number:</td>
                    <td><strong>${userData.phoneNumber}</strong></td>
                </tr>
                <tr>
                    <td>Email:</td>
                    <td><strong>${userData.email}</strong></td>
                </tr>
                <tr>
                    <td>Registration Date/Time:</td>
                    <td><strong>${registrationDate}</strong></td>
                </tr>
             </table>  
              <hr style="border: 1px solid #ddd;">
              <p style="color: #777; font-size: 12px; text-align: center;">This email was sent automatically. Please do not reply.</p>
              <p style="color: #777; font-size: 12px; text-align: center;">Timestamp: ${new Date().toLocaleString()}</p>
              <hr style="border: 1px solid #ddd;">
              ${getEmailFooter()}
            `,
    };
    await transporter.sendMail(userMailOptions);

    // Send registration details to admin email
    const adminMailOptions = {
      from: process.env.EMAIL,
      to: process.env.ADMIN_EMAIL.split(","),
      subject: `Foxx Bioprocess Custom SUT Catalog Registration (ID: ${registrationId})`,
      html: `
            ${getEmailHeader()}
              <p>New user Registered for Foxx Bioprocess Custom SUT Catalog:</p>
              <hr style="border: 1px solid #ddd;">
              <table border="1" cellpadding="5" width="100%">
                <tr>
                    <td>Registration ID:</td>
                    <td><strong>${registrationId}</strong></td>
                </tr>
                <tr>
                    <td>First Name:</td>
                    <td><strong>${userData.firstName}</strong></td>
                </tr>
                <tr>
                    <td>Last Name:</td>
                    <td><strong>${userData.lastName}</strong></td>
                </tr>
                <tr>
                    <td>Job Title:</td>
                    <td><strong>${userData.jobTitle}</strong></td>
                </tr>
                <tr>
                    <td>Company or University:</td>
                    <td><strong>${userData.company}</strong></td>
                </tr>
                <tr>
                    <td>Department:</td>
                    <td><strong>${userData.department}</strong></td>
                </tr>
                <tr>
                    <td>Street Address:</td>
                    <td><strong>${userData.streetAddress}</strong></td>
                </tr>
                <tr>
                    <td>Zip Code/Postal Code:</td>
                    <td><strong>${userData.postalCode}</strong></td>
                </tr>
                <tr>
                    <td>Country:</td>
                    <td><strong>${userData.selectedCountry}</strong></td>
                </tr>
                <tr>
                    <td>State:</td>
                    <td><strong>${userData.selectedState}</strong></td>
                </tr>
                <tr>
                    <td>Phone Number:</td>
                    <td><strong>${userData.phoneNumber}</strong></td>
                </tr>
                <tr>
                    <td>Email:</td>
                    <td><strong>${userData.email}</strong></td>
                </tr>
                <tr>
                    <td>Registration Date/Time:</td>
                    <td><strong>${registrationDate}</strong></td>
                </tr>
             </table>  
             <hr style="border: 1px solid #ffffff;">
             <div style="text-align: center;">

             <a href="${
               process.env.SERVER_URL
             }/accept-registration?userData=${encodeURIComponent(
        JSON.stringify(userData)
      )}" style="background-color: #4CAF50; /* Green */
             border: none;
             color: white;
             padding: 5px 10px 5px 10px;
             text-align: center;
             text-decoration: none;
             display: inline-block;
             font-size: 16px;
             margin: 4px 2px;
             cursor: pointer;
             border-radius: 8px;
             display: inline-block; 
             width: auto;
             text-align: center; 
             line-height: 40px; 
             text-decoration: none; 
             margin: 0 10px; 
             font-family: Arial, sans-serif;
             font-size: 16px;
             font-weight: bold; 
             outline: none; 
             ">Accept Request</a>


             <a href="${
               process.env.SERVER_URL
             }/reject-registration?userData=${encodeURIComponent(
        JSON.stringify(userData)
      )}" style="background-color: #f44336;
               border: none;
               color: white;
               padding: 5px 10px 5px 10px;
               text-align: center;
               text-decoration: none;
               display: inline-block;
               font-size: 16px;
               margin: 4px 2px;
               cursor: pointer;
               border-radius: 8px;
               display: inline-block; 
               width: auto;
               text-align: center; 
               line-height: 40px; 
               text-decoration: none; 
               margin: 0 10px; 
               font-family: Arial, sans-serif;
               font-size: 16px;
               font-weight: bold; 
               outline: none; 
             ">Reject Request</a>

           </div>
           <p style="color: #777; font-size: 12px; text-align: center;">This email was sent automatically. Please do not reply.</p>
           <p style="color: #777; font-size: 12px; text-align: center;">Timestamp: ${new Date().toLocaleString()}</p>
           <hr style="border: 1px solid #ddd;">        
              ${getEmailFooter()}
            `,
    };
    await transporter.sendMail(adminMailOptions);

    // Append data to Google Sheets
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Sheet1!A2:N2", // Assuming 'Total Registration' count starts from cell O2
      valueInputOption: "RAW",
      resource: {
        values: [
          [
            registrationId,
            userData.firstName,
            userData.lastName,
            userData.jobTitle, // New field: Job Title
            userData.company, // New field: Company or University
            userData.department, // New field: Company/University Department
            userData.streetAddress, // New field: Street Address
            userData.postalCode, // New field: Postal Code
            userData.selectedCountry, // New field: Country
            userData.selectedState,
            userData.phoneNumber,
            userData.email,
            userData.note,
            registrationDate,
            userData.registrationDate
          ],
        ],
      },
    });

    // console.log(
    //   "Registration data added to Google Sheets:",
    //   appendResponse.data
    // );

    // Set a cookie to indicate successful registration
    res.cookie("registered", "true", { maxAge: 900000, httpOnly: true }); // Expires after 15 minutes


    // Send the HTML response
    // Redirect to the confirmation page
   // Update session to reflect successful registration
   req.session.email = userData.email;
   req.session.allowedAccess = true;
   req.session.confirmedRegistration = true;
   req.session.isEmailVerified = true;

   // Save the session before redirecting
   req.session.save((err) => {
     if (err) {
       console.error('Session save error:', err);
       return res.status(500).send('Session error');
     }
     // Redirect to the confirmation page
     res.redirect('/identity/account/registration/confirmation');
   });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).send("Registration failed.");
  }
});


app.post('/resend-confirmation', async (req, res) => {
  try {
    const userEmail = req.body.email;

    // Fetch the user data from the database
    const userData = await UserData.findOne({ email: userEmail });
    if (!userData) {
      return res.status(404).send("User not found");
    }

    // Update the registration date
    userData.registrationDate = new Date();
    await userData.save();

    // Get the current date and time
    const registrationDate = new Date().toLocaleString();

    // Send confirmation email to the user
    const userMailOptions = {
      from: process.env.EMAIL,
      to: userData.email,
      subject: "Resend Registration Confirmation for Foxx Bioprocess Custom SUT Catalog",
      html: `
            Foxx Bioprocess Custom SUT Catalog Re-send confirmation email
            ${getEmailHeader()}
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgb(247, 247, 247);">
                    <tbody><tr style="height: 60px;" height="60">
                        <td>
                            <div style="margin: 15px 48px;">
                                <span style="font-family: HelveticaNeue-Light, Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 300; line-height: 28px; color: rgb(34, 34, 34); vertical-align: middle; display: table-cell;">
                                    We’ve received your registration for <span>Foxx Bioprocess Custom SUT Catalog</span>
                                </span>
                            </div>
                        </td>
                    </tr>
                </tbody></table>
              <table style="width: 100%; max-width:600px;margin:0 auto; font-family: Arial, sans-serif; border-collapse: collapse;">
            <tr>
            <td style="padding: 20px; padding-left:0px; text-align: left;">
            <p>Dear, <strong>${
              userData.firstName
            }</strong>&nbsp;<strong>${
              userData.lastName
            }</strong> </p>
              <p style="font-size: 16px; color: #585d6a; line-height: 1.5; padding-bottom:10px">
                Thank you for registering on <span style="font-weight: bold;">foxxbioprocess.com</span>.
                You have successfully registered as a user.
              </p>
              <p style="font-size: 16px; color: #585d6a; line-height: 1.5;padding-bottom:20px;">
                Now you can wait for your application approval. When your application is approved by our team, you will receive an email notification on your registered email ID.
              </p>
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin-top: 20px;margin-bottom:20px">
              <tr>
                  <td bgcolor="#007bff" style="border-radius: 4px;">
                      <a href="https://custom-sut-catalog.foxxbioprocess.com/identity/account/registration/confirmation" style="padding: 10px 20px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block;" target="_blank">Application Status</a>
                  </td>
              </tr>
          </table>
              <p style="font-size: 16px; color: #585d6a; font-weight:900; line-height: 1.5;">
                Once approved, you can:
              </p>
              <ul style="list-style-type: none; padding: 0; font-size: 16px; color: #585d6a;">
                <li style="padding: 5px 0;">&#8226; Access to 1000+ Customer Facing Diagrams Sets</li>
                <li style="padding: 5px 0;">&#8226; Customize your SUT</li>
                <li style="padding: 5px 0;">&#8226; Enquiry Support</li>
                <li style="padding: 5px 0;">&#8226; Access to other material</li>
              </ul>
            </td>
          </tr>
        </table>
              <table border="1" cellpadding="5" style="width: 100%; max-width:600px;margin:0 auto; font-family: Arial, sans-serif; border-collapse: collapse;">
              <hr style="border: 1px solid #ddd; max-width:600px;margin:0 auto;">
              <p style="padding:20px;padding-left:0px; max-width:600px;margin:0 auto;">Here are your registration details:</p>
                <tr>
                    <td>Registration ID:</td>
                    <td><strong>${userData.registrationId}</strong></td>
                </tr>
                <tr>
                    <td>First Name:</td>
                    <td><strong>${userData.firstName}</strong></td>
                </tr>
                <tr>
                    <td>Last Name:</td>
                    <td><strong>${userData.lastName}</strong></td>
                </tr>
                <tr>
                    <td>Job Title:</td>
                    <td><strong>${userData.jobTitle}</strong></td>
                </tr>
                <tr>
                    <td>Company or University:</td>
                    <td><strong>${userData.company}</strong></td>
                </tr>
                <tr>
                    <td>Department:</td>
                    <td><strong>${userData.department}</strong></td>
                </tr>
                <tr>
                    <td>Street Address:</td>
                    <td><strong>${userData.streetAddress}</strong></td>
                </tr>
                <tr>
                    <td>Zip Code/Postal Code:</td>
                    <td><strong>${userData.postalCode}</strong></td>
                </tr>
                <tr>
                    <td>Country:</td>
                    <td><strong>${userData.selectedCountry}</strong></td>
                </tr>
                <tr>
                    <td>State:</td>
                    <td><strong>${userData.selectedState}</strong></td>
                </tr>
                <tr>
                    <td>Phone Number:</td>
                    <td><strong>${userData.phoneNumber}</strong></td>
                </tr>
                <tr>
                    <td>Email:</td>
                    <td><strong>${userData.email}</strong></td>
                </tr>
                <tr>
                    <td>Registration Date/Time:</td>
                    <td><strong>${registrationDate}</strong></td>
                </tr>
             </table>  
              <hr style="border: 1px solid #ddd;">
              <p style="color: #777; font-size: 12px; text-align: center;">This email was sent automatically. Please do not reply.</p>
              <p style="color: #777; font-size: 12px; text-align: center;">Timestamp: ${new Date().toLocaleString()}</p>
              <hr style="border: 1px solid #ddd;">
              ${getEmailFooter()}
            `,
    };
    await transporter.sendMail(userMailOptions);

    res.status(200).send("Confirmation email sent successfully.");
  } catch (error) {
    console.error("Resend confirmation email error:", error);
    res.status(500).send("Failed to send confirmation email.");
  }
});


// endpoint use to fetch register user data on ((identity/account/registration/confirmation)) 
app.get('/register/user-data', async (req, res) => {
  try {
    // First try to get email from query parameter, then from session
    const userEmail = req.query.email || req.session.email;

    if (!userEmail) {
      return res.status(400).json({ error: 'User email is not available in the session or query parameters.' });
    }

    const userData = await UserData.findOne({ email: userEmail }).exec();
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Error fetching user data.' });
  }
});


// const checkReferrerAndSetSession = (req, res, next) => {
//   const referrer = req.headers.referer;
//   if (referrer && referrer.includes('/identity/auth-ui/email/verify')) {
//     req.session.confirmedRegistration = true;
//     next();
//   } else {
//     res.sendFile(path.join(__dirname, 'public', 'access-denied', 'confirmation-model-denied.html'));
//   }
// };


const checkConfirmationAccess = (req, res, next) => {
  const referrer = req.get('Referrer');
  const { allowedAccess, confirmedRegistration, isEmailVerified, notificationAccessAllowed, email } = req.session;

  // Allow access if user has a valid session with email (same browser)
  if (email && req.session.id) {
    return next();
  }

  // Allow access from proper referrer or with proper session flags
  if (
    (referrer && referrer.includes('/identity/auth-ui/email/verify')) || 
    (allowedAccess && confirmedRegistration && isEmailVerified) || 
    notificationAccessAllowed
  ) {
    // Clear notificationAccessAllowed to avoid future access
    req.session.notificationAccessAllowed = null;
    return next();
  } else {
    return res.redirect('/confirmation/denied');
  }
};


app.get('/identity/account/registration/confirmation', checkConfirmationAccess, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'confirmation-registration.html'));
});

app.post('/identity/account/registration/confirmation', async (req, res) => {
  try {
   // console.log('Confirmation endpoint hit successfully.');
    req.session.allowedAccess = true;
   // console.log('Request Body:', req.body);

    // Respond to the client with a success message
    res.status(200).json({ message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Error confirming registration:', error);
    res.status(500).send('Error confirming registration.');
  }
});


// Route for denied access
app.get('/confirmation/denied', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'access-denied', 'confirmation-model-denied.html'));
});


app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});



// endpoint used on the (( /identity/auth-ui/email/verify )) to fetch user email data for OTP generation
app.post('/identity/account/registration/confirmation/data', async (req, res) => {
  try {
    const formData = await FormDataModel.findOne().sort({ _id: -1 }).exec();
    res.json(formData);
} catch (error) {
    console.error('Error fetching form data:', error);
    res.status(500).send('Error fetching form data.');
}
});


// function isOTPVerified(session) {
//   return session && session.isOTPVerified === true;
// }

// Express route for serving the HTML form
app.get("/identity/account/registration", (req, res) => {
  try {
    // Check if the user has registered by checking the cookie
    const hasRegistered = req.cookies && req.cookies["registered"] === "true";

    if (hasRegistered) {
      // If registered, show the message
      res.send("You are registered for Bioprocess custom sut catalog");
    } else {
      // If not registered, show the form
      res.sendFile(path.join(__dirname, "public", "register.html"));
    }
  } catch (error) {
    console.error("Error serving form:", error);
    res.status(500).send("Error serving form.");
  }
});

// Assume you have a database or some form of storage to track confirmations
// You can use a simple in-memory object for demonstration purposes

const JWT_SECRET = process.env.JWT_SECRET;

function generateToken1(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" }); // Token expires in 1 day
}

const confirmationStatus = {};

app.get("/accept-registration", async (req, res) => {
  try {
    const userData = JSON.parse(decodeURIComponent(req.query.userData));
    const userEmail = userData.email;
    const userFirstName = userData.firstName; // Extract user's first name

    const user = await AcceptedUser.findOne({ email: userEmail }).exec();

    // If user is already accepted, return without further action
    if (user && user.accepted) {
      const rejectedTime = user.acceptedTime ? moment(user.acceptedTime).format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
      const message = `User is already accepted. Accepted Time: ${rejectedTime}. <a href="/reject-registration?userData=${encodeURIComponent(JSON.stringify(userData))}">Click here</a> to reject the user.`;
      // console.log(message);
      return res.status(200).send(message);
    }

    // Generate JWT token
    const token = generateToken1({ email: userEmail });

    // Generate token
    console.log("Generated Token:", token); // Log the generated token

    // Find and update the existing user in MongoDB
    await AcceptedUser.findOneAndUpdate(
      { email: userEmail },
      {
        firstName: userFirstName,
        accepted: true,
        token,
        acceptedTime: moment().format('YYYY-MM-DD HH:mm:ss'),
        notificationSentStatus: true,
        notificationStatusTime: moment().format('YYYY-MM-DD HH:mm:ss')
      },
      { new: true, upsert: true }
    );

   // console.log("User updated with accepted token:", token); // Log the saved token

    // Send email notification to the user
    const userMailOptions = {
      from: process.env.EMAIL,
      to: userEmail,
      subject:
        "Registration Accepted for Custom Sut Catalog (Foxx Bio Process)",
      html: `
      ${getEmailHeader()}
      <div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
        <div style="background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px 0px rgba(0,0,0,0.1);">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgb(247, 247, 247);">
                    <tbody><tr style="height: 60px;" height="60">
                        <td>
                            <div style="margin: 15px 48px;">
                                <span style="font-family: Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 300; line-height: 28px; color: rgb(34, 34, 34); vertical-align: middle; display: table-cell;">
                                  Registration Application Accepted for Custom Sut Catalog
                                </span>
                            </div>
                        </td>
                    </tr>
                </tbody></table>
          <p style="color: #585d6a; font-size: 16px;">Dear User,</p>
          <p style="color: #585d6a; font-size: 16px;">Your registration application request has been accepted by the <strong>Foxx Bioprocess Team</strong>. You can now proceed to log in with your registered email ID!!</p>
          <table style="margin-top: 20px; width: 100%;">
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Your Registered email ID is: ${userEmail}</td>
              <td style="padding: 10px; border: 1px solid #ddd;"><a href="https://custom-sut-catalog.foxxbioprocess.com/account-center/signin-identifier?token=${token}"  style="text-decoration: none; color: #fff; background-color: #007bff; padding: 8px 12px; border-radius: 5px;" target="_blank">Click here to Login</a></td>
            </tr>
          </table>
          <hr style="border: 1px solid #ddd;">
          <p style="color: #777; font-size: 12px; text-align: center;">This email was sent automatically. Please do not reply.</p>
          <p style="color: #777; font-size: 12px; text-align: center;">Timestamp: ${new Date().toLocaleString()}</p>
        </div>
      </div>
      ${getEmailFooter()}
    `,
    };
    await transporter.sendMail(userMailOptions);


    // Check for user subscription before sending push notification
    const subscription = await Subscription.findOne({ email: userEmail }).exec();

    if (subscription) {
      // Call function to send push notifications
      const pushNotificationAcceptResponse = await sendAcceptNotificationToUser({ ...userData, firstName: userFirstName, email: userEmail });
      //console.log('Accepted Notification sent successfully:', pushNotificationAcceptResponse);
    } else {
      console.log(`No subscription found for email: ${userEmail}. Push notification not sent.`);
    }

    // res.send("Registration accepted successfully!");
    res.sendFile(
      path.join(__dirname, "public", "registration-accepted-successfully.html")
    );

   // console.log(`Accepted user: `, userData.email);
  } catch (error) {
    console.error("Error accepting registration:", error);
    res.status(500).send("Failed to accept registration.");
  }
});


app.get("/reject-registration", async (req, res) => {
  try {
    const userData = JSON.parse(decodeURIComponent(req.query.userData));
    const userEmail = userData.email;
    const userFirstName = userData.firstName; // Extract user's first name

    // Find the existing user in MongoDB
    const user = await AcceptedUser.findOne({ email: userEmail }).exec();

    // If user is already rejected, return without further action
    if (user && user.accepted === false) {
      const rejectedTime = user.acceptedTime ? moment(user.acceptedTime).format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
      const message = `User already rejected. Rejected Time: ${rejectedTime}. <a href="/accept-registration?userData=${encodeURIComponent(JSON.stringify({ email: userEmail, firstName: userFirstName }))}">Click here</a> to accept the user.`;
      return res.status(200).send(message);
    }

    // Serve the HTML file for rejection reasons from the 'public/access-denied' folder
    res.sendFile(path.join(__dirname, "public", "access-denied", "registration-rejected-reason.html"));

  } catch (error) {
    console.error("Error rendering rejection reasons form:", error);
    res.status(500).send("Failed to render rejection reasons form.");
  }
});

app.post("/reject-registration", async (req, res) => {
  try {
    const userData = JSON.parse(decodeURIComponent(req.query.userData));
    const userEmail = userData.email;
    const userFirstName = userData.firstName; // Extract user's first name
    const { reason } = req.body;

    // Find the existing user in MongoDB
    const user = await AcceptedUser.findOne({ email: userEmail }).exec();

    // If user is already rejected, return without further action
    if (user && user.accepted === false) {
      const rejectedTime = user.acceptedTime ? moment(user.acceptedTime).format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
      const message = `User already rejected. Rejected Time: ${rejectedTime}. <a href="/accept-registration?userData=${encodeURIComponent(JSON.stringify(userData))}">Click here</a> to accept the user.`;
      // console.log(message);
      return res.status(200).send(message);
    }

    // Generate token (optional if needed for rejection)
    const token = jwt.sign({ email: userEmail }, JWT_SECRET, {
      expiresIn: "1d",
    }); // Token expires in 1 day

   // console.log("Generated Token:", token); // Log the generated token

    // Find and update the existing user in MongoDB
    await AcceptedUser.findOneAndUpdate(
      { email: userEmail },
      {
        firstName: userFirstName,
        accepted: false,
        token,
        acceptedTime: moment().format('YYYY-MM-DD HH:mm:ss'), // Set the acceptedTime field to the current date and time as a string
        notificationSentStatus: false,
        notificationStatusTime: moment().format('YYYY-MM-DD HH:mm:ss')
      },
      { new: true, upsert: true }
    );

    //console.log("User updated with rejected token:", token); // Log the saved token

    const userMailOptions = {
      from: process.env.EMAIL,
      to: userEmail,
      subject:
        "Registration Rejected for Custom Sut Catalog (Foxx Bio Process)",
        html: getEmailRejectedTemplate(reason),
    };
    await transporter.sendMail(userMailOptions);

    // Call function to send push notifications
    const subscription = await Subscription.findOne({ email: userEmail }).exec();

    if (subscription) {
      // Call function to send push notifications
      const pushNotificationResponse = await sendRejectNotificationToUser({ ...userData, firstName: userFirstName, email: userEmail, reason });
     // console.log('Rejected Notification sent successfully:', pushNotificationResponse);
    } else {
      console.log(`No subscription found for email: ${userEmail}. Push notification not sent.`);
    }

    // res.send("Registration accepted successfully!");
    res.sendFile(path.join(__dirname, "public", "registration-rejected.html"));
  } catch (error) {
    console.error("Error rejecting registration:", error);
    res.status(500).send("Failed to reject registration.");
  }
});

// Route to handle accepting a user
app.get("/accept-user", async (req, res) => {
  try {
    const { email, firstName } = req.query;

    // Find and update the existing user or create a new one
    const acceptedUser = await AcceptedUser.findOneAndUpdate(
      { firstName },
      { email },
      { 
        accepted: true,
        acceptedTime: new Date(),// Set the acceptedAt field to the current date and time
      },
      { new: true, upsert: true }
    );

   // console.log(`${accepted ? 'Accepted' : 'Rejected'} user:`, acceptedUser); // Log the accepted/rejected user
     // Send JSON response with the updated user's accepted status
     res.json({ accepted: acceptedUser.accepted, acceptedTime: acceptedUser.acceptedTime });
  } catch (error) {
    console.error("Error accepting user:", error);
    res.status(500).send("Failed to accept user.");
  }
});


// Backend endpoint to fetch the real-time status and send data
app.get("/check-status-of-confirmation", async (req, res) => {
  try {
    // Assuming you want to fetch the status by email or another identifier
    const { email } = req.query;

    // Find the user by email and get the real-time data
    const acceptedUser = await AcceptedUser.findOne({ email });

    if (!acceptedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Send the accepted status
    res.json({
      accepted: acceptedUser.accepted,
      acceptedTime: acceptedUser.acceptedTime,
    });
  } catch (error) {
    console.error("Error fetching accepted status:", error);
    res.status(500).send("Failed to fetch accepted status.");
  }
});

// AcceptedUser.watch().on('change', async (change) => {
//   console.log('Change detected:', change); 
//   if (change.operationType === 'update') {
//     const { accepted } = change.updateDescription.updatedFields;
//     let email; 

//     try {

//       const userData = await AcceptedUser.findOne({ _id: change.documentKey._id });
//       if (!userData) {
//         throw new Error('User data not found');
//       }
//       email = userData.email;

//       if (accepted === true) {
//         const { firstName } = userData;


//         const notificationPayload = {
//           notification: {
//             title: `Application Accepted, ${firstName}`,
//             body: `Dear ${firstName}, your application has been accepted by the admin. ${email}`,
//             icon: 'https://foxxbioprocess.com/cdn/shop/files/Foxx_Logo_Tagline_0e42bd12-4dce-4fda-abf8-db37715e463d.png?v=1669752062&width=300',
//             data: {
//               url: '/'
//             },
//           },
//         };

//         const subscription = await Subscription.findOne({ email }).exec();
//         if (!subscription) {
//           throw new Error('Subscription not found for user');
//         }

//         const pushNotificationResponse = await sendPushNotification(subscription, JSON.stringify(notificationPayload));
//         console.log('Accepted Notification sent successfully:', pushNotificationResponse);
//       } else if (accepted === false) {
//         const { firstName } = userData;


//         if (!firstName) {
//           throw new Error('First name not found in user data');
//         }

//         const notificationPayload = {
//           notification: {
//             title: `Application Rejected, ${firstName}`,
//             body: `Dear ${firstName}, your application has been rejected by the team. ${email}`,
//             icon: 'https://foxxbioprocess.com/cdn/shop/files/Foxx_Logo_Tagline_0e42bd12-4dce-4fda-abf8-db37715e463d.png?v=1669752062&width=300',
//             data: {
//               url: '/'
//             },
//           },
//         };

//         const subscription = await Subscription.findOne({ email }).exec();
//         if (!subscription) {
//           throw new Error('Subscription not found for user');
//         }

//         const pushNotificationResponse = await sendPushNotification(subscription, JSON.stringify(notificationPayload));
//         console.log('Rejected Notification sent successfully:', pushNotificationResponse);
//       }
//     } catch (error) {
//       console.error('Error processing change:', error);
//     }
//   }
// });

function generateNumericOtp(length) {
  if (length <= 0 || length > 10) throw new Error('OTP length must be between 1 and 10.');
  const otp = crypto.randomInt(0, Math.pow(10, length)).toString().padStart(length, '0');
  return otp;
}

// Route to handle passkey verification for login
app.post("/verify-passkey", async (req, res) => {
  try {
    const { email, passkey, firstName } = req.body;

    const acceptedUser = await AcceptedUser.findOne({ email, passkey });

    // Compute whether passkey is verified dynamically.
    const isPasskeyVerified = acceptedUser && acceptedUser.accepted && acceptedUser.passkey === passkey;

    if (isPasskeyVerified) {
      // Save the dynamic flag to the database (use a boolean value)
      acceptedUser.passkeyVerified = isPasskeyVerified;
      await acceptedUser.save();

      // req.session.user = {
      //   email: acceptedUser.email,
      //   firstName: acceptedUser.firstName,
      //   passkeyVerified: false 
      // };

        // Log the response before sending
      //  console.log({ message: "Welcome! You have successfully logged in.", email: email });
      // Send an email to the user
      await transporter.sendMail({
        from: process.env.EMAIL,
        to: email,
        subject: "Passkey Successfully Verified",
        html: `${getEmailHeader()}
          <div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
            <div style="background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px 0px rgba(0,0,0,0.1);">
              <p style="color: #585d6a; font-size: 16px;">Dear User,</p>
              <p style="color: #585d6a; font-size: 16px;">Your passkey has been successfully verified. You can now access your account.</p>
              <hr style="border: 1px solid #ddd;">
              <p style="color: #777; font-size: 12px; text-align: center;">This email was sent automatically. Please do not reply.</p>
              <p style="color: #777; font-size: 12px; text-align: center;">Timestamp: ${new Date().toLocaleString()}</p>
            </div>
          </div>
          ${getEmailFooter()}`,
      });
      res.json({ message: "Welcome! You have successfully logged in.", firstName: acceptedUser.firstName });
    } else {
      res.status(401).send("Incorrect passkey.");
    }
  } catch (error) {
    console.error("Error verifying passkey:", error);
    res.status(500).send("Failed to verify passkey.");
  }
});



// const checkReferrerLogin = (req, res, next) => {
//   const referrer = req.get('Referrer');
//   const signinIdentifierURL = `/account-center/signin-identifier`;

//   if (!referrer || !referrer.startsWith(signinIdentifierURL)) {
//     return res.redirect("/account-center/signin-identifier");
//   }

//   next();
// };

// Route to handle login form submission
app.post("/uas/portal/auth/login", async (req, res) => {
  try {
    const { email } = req.body;
    const acceptedUser = await AcceptedUser.findOne({ email });

    if (acceptedUser && acceptedUser.accepted) {
      const passkey = generateNumericOtp(6); 
    //  console.log("Generated passkey:", passkey);

      acceptedUser.passkey = passkey;
      await acceptedUser.save();

      await transporter.sendMail({
        from: process.env.EMAIL,
        to: email,
        subject: "One-Time Login Passkey for Custom Sut Catalog (Foxx Bio Process)",
        html: `${getEmailHeader()}
          <div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
            <div style="background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px 0px rgba(0,0,0,0.1);">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgb(247, 247, 247);">
            <tbody><tr style="height: 60px;" height="60">
                <td>
                    <div style="margin: 15px 48px;">
                        <span style="font-family: Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 300; line-height: 28px; color: rgb(34, 34, 34); vertical-align: middle; display: table-cell;">
                            Please verify your email address
                        </span>
                    </div>
                </td>
            </tr>
             </tbody></table>
              <p style="color: #585d6a; font-size: 16px;">Dear User,</p>
              <p style="color: #585d6a; font-size: 16px;">Your One-Time login Passkey is:</p>
              <div style="background-color: #f9f9f9; border: 1px solid #ccc; border-radius: 5px; padding: 10px; text-align: center; font-size: 24px; margin: 20px auto;">
                ${passkey}
              </div>
              <p style="color: #585d6a; font-size: 16px;">Please use this passkey to sign in to your account.</p>
              <hr style="border: 1px solid #ddd;">
              <p style="color: #777; font-size: 12px; text-align: center;">This email was sent automatically. Please do not reply.</p>
              <p style="color: #777; font-size: 12px; text-align: center;">Timestamp: ${new Date().toLocaleString()}</p>
            </div>
          </div>
          ${getEmailFooter()}`,
      });

      // Set the session user
      // req.session.user = {
      //   email: acceptedUser.email,
      //   firstName: acceptedUser.firstName,
      // };

    // Check for subscription data (if applicable)

    const subscription = await Subscription.findOne({ email });

    if (subscription) {
      const pushNotificationLoginOtp = await sendLoginOtpNotificationToUser({ email, firstName: acceptedUser.firstName, otp: passkey });
     // console.log('Login OTP Notification sent successfully:', pushNotificationLoginOtp);
      res.status(200).json({ message: 'Passkey sent and notification sent' });
    } else {
      res.send("Passkey sent to your email.");
    }
  } else {
    res.status(403).send("You are not authorized to log in.");
  }
  } catch (error) {
    console.error("Error checking authorization:", error);
    res.status(500).send("Failed to check authorization.");
  }
});



// New endpoint to check if email exists
app.get("/uas/portal/auth/check-email", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email query parameter is required." });
    }

    // Check if the email exists in the UserDatas schema
    const user = await UserData.findOne({ email });

    if (user) {
      // Email exists
      res.status(200).json({ exists: true });
    } else {
      // Email does not exist
      res.status(404).json({ exists: false, error: "Email not found. You have to register first" });
    }
  } catch (error) {
    console.error("Error checking email:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.get("/uas/portal/auth/get-user-token", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: "Email query parameter is required." });
    }

    // Find the user by email
    const user = await AcceptedUser.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "Email not found. You have to register first." });
    }

    // Check if the token exists in the user record (original token)
    if (!user.token) {
      return res.status(403).json({ error: "Token not found for this user." });
    }

    // Generate a new access token
    const accessToken = crypto.randomBytes(50).toString('hex');

    // Optionally, you can store or cache the access token as needed.
    // For example, save it in a cache with a TTL:
    tokenCache.set(`access_${email}`, accessToken);

    // Optionally update the user record with the access token if you need persistence:
    // await AcceptedUser.findOneAndUpdate({ email }, { access_token: accessToken }, { new: true });

    // Send both the original token and the new access token in the response
    res.status(200).json({ token: user.token, access_token: accessToken });
  } catch (error) {
    console.error("Error fetching token:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});




app.get("/uas/portal/auth/login", async (req, res) => {
  try {
    const { email } = req.query; // Retrieve the email from the query

    // Step 1: Find the user with the provided email
    const user = await AcceptedUser.findOne({ email });

    if (!user) {
      return res.status(403).send("Invalid login link: Email not found."); // If no user is found with the email
    }

    // Step 2: Check if the token is present in the database for that user
    if (!user.token) {
      return res.status(403).send("Token not found for this user.");
    }

    // Generate a new callback token only
    const callbackToken = crypto.randomBytes(50).toString('hex');

    // Save the callback token in the cache with a TTL (e.g., 604800 seconds)
    tokenCache.set(`callback_${email}`, callbackToken);

    // Update the user record with the new callback token
    const updatedUser = await AcceptedUser.findOneAndUpdate(
      { email },
      { callback_token: callbackToken },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(500).send("Failed to update tokens for the user.");
    }


    // Step 4: Set a temporary session user object.
    // Notice: We are not marking req.session.persist as true, so this session won't be saved in the store.
    // req.session.user = { email, token: user.token };

   // Step 4: If everything is correct, serve the login form HTML
     res.sendFile(path.join(__dirname, "public", "login.html"));


  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Login failed.");
  }
});




/// This code added on 4/23/2025 by adding extra security check before proceding to dashboard

app.get("/uas/portal/auth/verify-access", async (req, res) => {
  try {
    // Allow access only if the referrer contains "/uas/portal/auth/login"
    const ref = req.get("Referer") || "";
    if (!ref.includes("/uas/portal/auth/login")) {
      return res.sendFile(
        path.join(__dirname, "public", "access-denied", "confirmation-model-denied.html")
      );
    }

  //console.log("[verify-access] Request received:", req.query);
    const { email, access_token } = req.query;
    const cachedAccessToken = tokenCache.get(`access_${email}`);

    if (cachedAccessToken && cachedAccessToken === access_token) {
      const callbackToken = tokenCache.get(`callback_${email}`);
      if (!callbackToken) {
       // console.log("[verify-access] Callback token missing for:", email);
        return res.status(401).send("Callback token expired or not found.");
      }
     // console.log("[verify-access] Valid token. Preparing intermediate page for:", email);

      // Find the user data from your database
      const userData = await AcceptedUser.findOne({ email });
      if (!userData) {
        return res.status(404).send("User not found.");
      }
      // Instead of a redirect, send an HTML page that shows the next URL
      return res.send(`
        <html>
          <head>
            <title>Verifying Access | ${encodeURIComponent(email)}&${cachedAccessToken} | Foxx Bioprocess Custom SUT Dashboard</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet">
            <style>
              body {
                font-family: "Open Sans", sans-serif;
                font-size: 14px;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                flex-direction: column;
                background-color: #f8f8f8;
              }
              h1 {
                text-align: center;
                margin: 0;
              }
              /* Animated ellipsis displayed inline */
              .ellipsis::after {
                content: "";
                display: inline-block;
                vertical-align: baseline;
                animation: ellipsisAnimation 1.5s infinite;
              }
              @keyframes ellipsisAnimation {
                0%   { content: ""; }
                33%  { content: ". "; }
                66%  { content: ". . "; }
                100% { content: ". . ."; }
              }
            </style>
            <script>
              // Redirect after 2 seconds
              setTimeout(function() {
                window.location.href = '/uas/portal/auth/verify-callback?email=${encodeURIComponent(email)}&callback_token=${callbackToken}';
              }, 2000);
            </script>
          </head>
          <body>
            <h1>
              Just a moment ${userData.firstName}, we are getting things ready for you<span class="ellipsis"></span>
            </h1>
          </body>
        </html>
      `);
    } else {
      console.log("[verify-access] Invalid access token for email:", email);
      return res.status(401).send("Invalid access token.");
    }
  } catch (error) {
    console.error("Access token verification error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// New helper function to fetch country and timezone for a given IP.
async function getCountryInfo(ip) {
  // Handle local addresses.
  if (ip === "::1" || ip === "127.0.0.1") {
    return { country: "Local", timezone: "Local Timezone" };
  }

  try {
    console.log(`Fetching geo info for IP: ${ip}`);
    // Use the GeoJS geo endpoint that returns detailed information including timezone.
    const response = await axios.get(`https://get.geojs.io/v1/ip/geo/${ip}.json`);
    console.log(`Response from GeoJS for IP ${ip}:`, response.data);

    const country = response.data.country || "Unknown";
    const timezone = response.data.timezone || "Unknown";

    return { country, timezone };
  } catch (error) {
    console.error("Error fetching geo info for IP:", ip, error.message);
    return { country: "Unknown", timezone: "Unknown" };
  }
}

// Your verify-callback route now uses the new helper function.
app.get("/uas/portal/auth/verify-callback", async (req, res) => {
  try {
    // Ensure the caller came from /verify-access.
    const ref = req.get("Referer") || "";
    if (!ref.includes("/uas/portal/auth/verify-access")) {
      return res.sendFile(
        path.join(__dirname, "public", "access-denied", "confirmation-model-denied.html")
      );
    }

    const { email, callback_token } = req.query;
    const cachedCallbackToken = tokenCache.get(`callback_${email}`);

    // Dynamically compute callback validity flag.
    const isCallbackTokenVerified = cachedCallbackToken === callback_token;
    // Determine if access token was verified by checking the referrer.
    const isAccessTokenVerified = ref.includes("/uas/portal/auth/verify-access");

    if (isCallbackTokenVerified) {
      // Retrieve the user record.
      const userData = await AcceptedUser.findOne({ email });
      if (!userData) {
        return res.status(404).send("User not found.");
      }

      // Dynamically compute passkey verification result.
      const isPasskeyVerified = userData.passkeyVerified === true || userData.passkeyVerified === "true";

      // Get client IP and retrieve country/timezone information using the new function.
      const clientIP = getClientIP(req);
      console.log("[verify-callback] Retrieved client IP:", clientIP);

      const { country, timezone } = await getCountryInfo(clientIP);
      console.log("[verify-callback] Fetched country and timezone:", country, timezone);

      // Regenerate the session to ensure a fresh and secure session.
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).send("Internal Server Error");
        }

        // Save the full user session details along with the dynamically set flags.
        req.session.user = {
          email: userData.email,
          firstName: userData.firstName,
          passkeyVerified: isPasskeyVerified,           // Dynamically set result from the database.
          clientIP,                                      // Client IP address.
          country,                                       // Determined country.
          timezone,                                      // Determined timezone.
          accessTokenVerified: isAccessTokenVerified,      // Dynamically computed.
          callbackTokenVerified: isCallbackTokenVerified,
          loginAt: new Date().toISOString()
        };

        // Remove temporary tokens from the cache.
        tokenCache.del(`access_${email}`);
        tokenCache.del(`callback_${email}`);

        // Retrieve session id and expiry details.
        const sessionId = req.sessionID;
        const sessionExpires = req.session.cookie && req.session.cookie.expires
          ? new Date(req.session.cookie.expires).toISOString()
          : "Unknown";

        // console.log(
        //   "[verify-callback] Session verified for:",
        //   email,
        //   "IP:", clientIP,
        //   "Country:", country,
        //   "Timezone:", timezone,
        //   "SessionID:", sessionId,
        //   "Expires:", sessionExpires,
        //   "Session Data:", req.session.user
        // );

        // Render an intermediate page for the user.
        res.send(`
          <html>
            <head>
              <title>Getting Things Ready | ${encodeURIComponent(email)}&${cachedCallbackToken} | Dashboard</title>
              <link rel="preconnect" href="https://fonts.googleapis.com">
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
              <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet">
              <style>
                body {
                  font-family: "Open Sans", sans-serif;
                  font-size: 14px;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  flex-direction: column;
                  background-color: #f8f8f8;
                }
                h1 { text-align: center; margin: 0; }
                .ellipsis::after {
                  content: "";
                  display: inline-block;
                  vertical-align: baseline;
                  animation: ellipsisAnimation 1.5s infinite;
                }
                @keyframes ellipsisAnimation {
                  0% { content: ""; }
                  33% { content: ". "; }
                  66% { content: ". . "; }
                  100% { content: ". . ."; }
                }
              </style>
            <script>
            (function cacheSessionData() {
              // Remove the localStorage key "formData" entirely.
              localStorage.removeItem("formData");

              // Remove the localStorage key "userRole" entirely.
              localStorage.removeItem("userRole");

              // Update or set the value of localStorage key "userEmail".
              // Ensure you pass the correct email value (here we assume it's available via a template variable).
              localStorage.setItem("userEmail", "${userData.email || ''}");

              // Save session related data into sessionStorage.
              const sessionData = {
                sessionId: "${sessionId}",
                sessionExpires: "${sessionExpires}",
                clientIP: "${clientIP}",
                country: "${country}",
                timezone: "${timezone}"
              };
              sessionStorage.setItem("sessionData", JSON.stringify(sessionData));
            })();

            setTimeout(function() {
              const params = new URLSearchParams({
                clientIP: "${clientIP}",
                country: "${country}",
                timezone: "${timezone}",
                ssnId: "${sessionId}",
                exp: "${sessionExpires}"
              });
              // Redirect to the dashboard with the query parameters.
              window.location.href = '/v1/portal/csutc/dashboard?' + params.toString();
            }, 2000);

            setTimeout(function() {
              history.replaceState(null, '', '/v1/portal/csutc/dashboard');
            }, 3000);
          </script>

            </head>
            <body>
              <h1>
                Just a moment ${userData.firstName}, we are getting things ready for you<span class="ellipsis"></span>
              </h1>
            </body>
          </html>
        `);
      });
    } else {
      console.log("[verify-callback] Invalid callback token for:", email);
      return res.status(401).send("Invalid callback token.");
    }
  } catch (error) {
    console.error("Callback token verification error:", error);
    res.status(500).send("Internal Server Error");
  }
});





/////////////////////////////////////////////////////////////////////////////

// Serve static files for client dashboard
// app.use('/client', express.static(path.join(__dirname, './client-Dashboard/client/build')));

// Modify the '/dashboard' endpoint to handle user authentication and render the dashboard
app.post("/v1/portal/csutc/dashboard", authenticate, async (req, res) => {
  // Log the current session user for debugging purposes.
 // console.log("[Dashboard POST] Session user:", req.session.user);

  try {
    // Extract the email directly from the session.
    const email = req.session?.user?.email;
    if (!email) {
      console.error("[Dashboard POST] No email found in session.");
      return res.status(401).send("User not authenticated.");
    }

    // Retrieve the accepted user record using the session email.
    const acceptedUser = await AcceptedUser.findOne({ email });
    if (acceptedUser) {
      // Check for user acceptance and verified passkey.
      // Note: Since passkey is no longer coming from the request body,
      // we're relying on the session or previously stored data.
      if (acceptedUser.accepted && acceptedUser.passkeyVerified === "true") {
        // Retrieve additional user details.
        const userData = await UserData.findOne({ email });

        // Update the session with the verified user details.
        req.session.user = {
          email: acceptedUser.email,
          firstName: userData.firstName,
          passkeyVerified: true,
          accessTokenVerified: true,
          callbackTokenVerified: true
        };

        const responseData = {
          user: {
            email: acceptedUser.email,
            firstName: userData.firstName
          }
        };

        res.json(responseData);
      } else if (!acceptedUser.accepted) {
        return res.redirect("/request-rejected");
      } else {
        return res.status(401).send("Incorrect passkey.");
      }
    } else {
      return res.status(404).send("User not found.");
    }
  } catch (error) {
    console.error("Error handling login:", error);
    return res.status(500).send("Internal Server Error");
  }
});


app.use((req, res, next) => {
  if (req.path === "/v1/portal/csutc/dashboard") {
   // console.log("[Dashboard Middleware] Current session:", req.session);
    if (!req.session.user ||
      req.session.user.passkeyVerified !== true ||
      req.session.user.accessTokenVerified !== true ||
      req.session.user.callbackTokenVerified !== true) {
      const client_ip = getClientIP(req);
      const mode = "customsutlogin";
      const scope = "openid";

      if (!client_ip || !scope || !mode) {
        return res.status(400).send("Missing required parameters");
      }

      const token = jwt.sign({ client_ip, scope, mode }, JWT_SECRET_KEY, {
        expiresIn: "1h", // The token expires in 1 hour
      });

      // Constructing the redirect URL for the user to see in the browser
      const finalRedirectUrl = `/account-center/proxy?context=${token}&client_ip=${client_ip}`;

      // Redirecting the user to /account-center/proxy with the context token and client IP
      return res.redirect(finalRedirectUrl);
    }
  }
  next();
});


// Middleware to serve static files from the React app
app.use(express.static(path.join(__dirname, './client-Dashboard/client/build')));

// Use the router for dashboard-related API endpoints
app.use('/client/api/', clientApp); // Ensure this matches your API endpoint


// app.get("/v1/portal/csutc/dashboard", authenticate, async (req, res) => {
//   try {

//     if (!req.session.user || req.session.user.passkeyVerified !== true) {
//       return res.redirect("/account-center/signin-identifier");
//     }

//     const userEmail = req.session.user.email;
//     const userFirstName = req.session.user.firstName;

//     const filePath = path.join(__dirname, "public", "dashboard.html");

//     fs.readFile(filePath, "utf8", (err, data) => {
//       if (err) {
//         console.error("Error reading HTML file:", err);
//         return res.status(500).send("Internal Server Error");
//       }

//       let populatedHtml = data.replace(
//         '<span id="user-email"></span>',
//         userEmail
//       );
//       populatedHtml = populatedHtml.replace(
//         '<span id="user-firstname"></span>',
//         userFirstName
//       );

//       res.send(populatedHtml);
//     });
//   } catch (error) {
//     console.error("Error accessing dashboard:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });
app.get('/v1/portal/csutc/dashboard', (req, res) => {
  // Log the request path and current session details.
 // console.log("[Dashboard GET] Current session:", req.session);

  if (
    !req.session.user ||
    req.session.user.passkeyVerified !== true ||
    req.session.user.accessTokenVerified !== true ||
    req.session.user.callbackTokenVerified !== true
  ) {
    //console.log("[Dashboard GET] Session invalid; redirecting to /account-center/signin-identifier");
    return res.redirect('/account-center/signin-identifier');
  }

  res.sendFile(path.join(__dirname, './client-Dashboard/client/build', 'index.html'), (err) => {
    if (err) {
      console.error(`Error sending index.html for /v1/portal/csutc/dashboard: ${err.message}`);
      res.status(500).send('Internal Server Error');
    }
  });
});


app.get('/v1/portal/csutc/dashboard/*', (req, res) => {
   // Log the request path and current session details.
  // console.log("[Dashboard GET] Current session:", req.session);

   if (
    !req.session.user ||
    req.session.user.passkeyVerified !== true ||
    req.session.user.accessTokenVerified !== true ||
    req.session.user.callbackTokenVerified !== true
  ) {
   // console.log("[Dashboard GET] Session invalid; redirecting to /account-center/signin-identifier");
    return res.redirect('/account-center/signin-identifier');
  }
  res.sendFile(path.join(__dirname, './client-Dashboard/client/build', 'index.html'), (err) => {
    if (err) {
      console.error(`Error sending index.html for /v1/portal/csutc/dashboard/*: ${err.message}`);
      res.status(500).send('Internal Server Error');
    }
  });
});



// app.get("/logout", async (req, res) => {
//   if (!req.session.user || !req.session.user.email) {
//     return res.status(400).send("No user logged in");
//   }

//   const userEmail = req.session.user.email;

//   try {
//     // Update the passkeyVerified field to "false"
//     await AcceptedUser.findOneAndUpdate(
//       { email: userEmail },
//       { passkeyVerified: "false" }
//     );

//     // Destroy the session to log out the user
//     req.session.destroy((err) => {
//       if (err) {
//         console.error("Error logging out:", err);
//         res.status(500).send("Internal Server Error");
//       } else {
//         res.redirect("/uas/portal/auth/login"); // Redirect to the login page after logout
//       }
//     });
//   } catch (error) {
//     console.error("Error updating passkeyVerified field:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

// testing not work
app.get("/request-rejected", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "request-rejected.html"));
});

// app.get("/v1/portal/csutc/userdata", authenticate, async (req, res) => {
//   try {

//     const userEmail = req.session.user.email;


//     const userData = await UserData.findOne({ email: userEmail });

//     if (userData) {

//       res.json({
//         email: userData.email,
//         firstName: userData.firstName,
//         lastName: userData.lastName,
//         phoneNumber: userData.phoneNumber,
//       });
//     } else {
//       res.status(404).send("User data not found.");
//     }
//   } catch (error) {
//     console.error("Error fetching user data:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });


app.use('/v1/portal/csutc/userdata', userDataRouter);

// Assume you have a route to check the status
// Assume you have a route to check the status
// app.get("/check-status", authenticate, async (req, res) => {
//   try {
//     const userEmail = req.session.user.email;

//     const user = await AcceptedUser.findOne({ email: userEmail });

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const userStatus = user.accepted; // This should be true or false

//     res.json({ status: userStatus });
//   } catch (err) {
//     console.error("Error checking status:", err);
//     res.status(500).json({ error: "Failed to check status" });
//   }
// });

// Add this route handler in your Express app setup

// Route to serve images
// Serve images only through authenticated route
// Serve images only through authenticated route
app.use(
  "/v1/portal/csutc/images",
  authenticate,
  express.static(path.join(__dirname, "public", "images"))
);
// Modify your route to fetch images
app.get("/v1/portal/csutc/image", authenticate, (req, res) => {
  const { type } = req.query;
  // Assuming images are stored as 'type-image.jpg' in the 'public/images' directory
  const imagePath = path.join(
    __dirname,
    "public",
    "images",
    `${type}-image.jpg`
  );
  res.sendFile(imagePath);
});

// Enquiry Data schema are under client-dashboard > server > models

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public", "uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif|pdf/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Images and PDFs Only!");
  }
}

app.post(
  "/v1/portal/csutc/submit-enquiry",
  upload.single("file-upload"),
  async (req, res) => {
    try {
      const enquiryData = new EnquiryData({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phoneNumber: req.body.phoneNumber,
        setType: req.body.setType,
        otherType: req.body.setType === 'others' ? req.body.otherType : null, // Save otherType if setType is "others"
        fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
      });

      await enquiryData.save();

      // Convert submittedAt to a readable format
      const submittedAtReadable = new Date(enquiryData.submittedAt).toLocaleString();
      // Email options for the user
      // const mailOptionsUser = {
      //   from: process.env.EMAIL,
      //   to: email,
      //   subject: 'Enquiry Confirmation',
      //   text: `Dear ${firstName},\n\nThank you for your enquiry about ${setType}. We will get back to you shortly.\n\nBest regards,\nYour Company`
      // };

      // Email options for the admin
      sendAdminNotificationEmail(enquiryData);
      sendUserConfirmationEmail(enquiryData);

      // Send emails
      // await transporter.sendMail(mailOptionsUser);

      res.status(200).json({
        message: "Enquiry submitted successfully",
        firstName: enquiryData.firstName,
        lastName: enquiryData.lastName,
        submittedAt: submittedAtReadable,
      });
    } catch (error) {
      console.error("Error submitting enquiry:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

function sendAdminNotificationEmail(enquiryData) {
  const mailOptions = {
    from: process.env.EMAIL,
    to: process.env.ADMIN_EMAIL,
    subject: "New Enquiry Submitted",
    html: `
      <h2>New Enquiry Submitted</h2>
      <p><strong>First Name:</strong> ${enquiryData.firstName}</p>
      <p><strong>Last Name:</strong> ${enquiryData.lastName}</p>
      <p><strong>Email:</strong> ${enquiryData.email}</p>
      <p><strong>Phone Number:</strong> ${enquiryData.phoneNumber}</p>
      <p><strong>Interested In:</strong> ${enquiryData.setType}</p>
      ${enquiryData.otherType ? `<p><strong>Other Type:</strong> ${enquiryData.otherType}</p>` : ''}
    `,
    attachments: enquiryData.fileUrl
      ? [
          {
            filename: path.basename(enquiryData.fileUrl),
            path: path.join(__dirname, "public", enquiryData.fileUrl),
          },
        ]
      : [],
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}

function sendUserConfirmationEmail(enquiryData) {
  const mailOptionsUser = {
    from: process.env.EMAIL,
    to: enquiryData.email,
    subject: "Enquiry Confirmation",
    text: `Dear ${enquiryData.firstName},\n\nThank you for your enquiry about ${enquiryData.setType}. We will get back to you shortly.\n\nBest regards,\nYour Company`,
  };
  transporter.sendMail(mailOptionsUser, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}


// GET request to fetch user data for settings page
// app.get(
//   "/v1/portal/csutc/dashboard/setting",
//   authenticate,
//   async (req, res) => {
//     try {
//       const userEmail = req.session.user.email;
//       const userData = await UserData.findOne({ email: userEmail });

//       if (userData) {
//         res.json(userData);
//       } else {
//         res.status(404).send("User not found.");
//       }
//     } catch (error) {
//       console.error("Error fetching user data:", error);
//       res.status(500).send("Internal Server Error");
//     }
//   }
// );

// POST request to update user data from settings page
// app.post(
//   "/v1/portal/csutc/dashboard/setting",
//   authenticate,
//   async (req, res) => {
//     try {
//       const userEmail = req.session.user.email;
//       const updatedData = req.body;

//       const result = await UserData.findOneAndUpdate(
//         { email: userEmail },
//         updatedData,
//         { new: true }
//       );

//       if (result) {
//         res.json(result);
//       } else {
//         res.status(404).send("User not found.");
//       }
//     } catch (error) {
//       console.error("Error updating user data:", error);
//       res.status(500).send("Internal Server Error");
//     }
//   }
// );

const ipInfoCache = new Map();

const getClientIP = (req) => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }
  return req.connection.remoteAddress;
};

const fetchCountryName = async (ip) => {
  try {
    console.log(`Fetching country for IP: ${ip}`);
    const response = await axios.get(`https://get.geojs.io/v1/ip/country/${ip}.json`);
    console.log(`Response from GeoJS for IP: ${ip}`, response.data);
    return response.data.country;
  } catch (error) {
    console.error('Error fetching country:', error.message);
    return null;
  }
};

const getCountryName = async (ip) => {
  if (ip === '::1' || ip === '127.0.0.1') {
    return 'Local';
  }

  if (ipInfoCache.has(ip)) {
    //console.log(`Cache hit for IP: ${ip}`);
    return ipInfoCache.get(ip);
  }

  const country = await fetchCountryName(ip);
  ipInfoCache.set(ip, country);
  return country;
};

app.use(async (req, res, next) => {
  req.user = {}; // Initialize req.user
  const clientIP = getClientIP(req);
  // console.log('Client IP:', clientIP);
  try {
    req.user.country = await getCountryName(clientIP);
   // console.log('Country:', req.user.country); // Log country name
  } catch (err) {
    console.error('Error getting country:', err.message);
    req.user.country = null; // handle appropriately
  }
  next();
});

app.get('/get-country', (req, res) => {
  const { country } = req.user;
  if (country) {
    res.json({ country });
    console.log('Country returned to client:', country);
  } else {
    res.status(500).json({ error: 'Country not available' });
  }
});

app.get('/get-client-ip', (req, res) => {
  const clientIP = getClientIP(req);
  res.json({ ip: clientIP });
  console.log('Client IP returned to client:', clientIP);
});

// Middleware to fetch country flag
app.get('/get-country-flag/:countryName', async (req, res) => {
  const { countryName } = req.params;
  console.log('Fetching flag for country:', countryName);
  try {
    const response = await axios.get(`https://flagsapi.com/${countryName}/flat/64.png`, {
      responseType: 'arraybuffer', // Ensure response is treated as binary
    });
    console.log('Country flag fetched for:', countryName);
    res.setHeader('Content-Type', 'image/png');
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching country flag:', error.message);
    res.status(500).send('Error fetching country flag');
  }
});

const getCountryAndTimezone = async (ip) => {
  if (ip === '::1' || ip === '127.0.0.1') {
    return { country: 'Local', timezone: 'Local Timezone' };
  }

  if (ipInfoCache.has(ip)) {
   // console.log(`Cache hit for IP: ${ip}`);
    return ipInfoCache.get(ip);
  }

  const maxRetries = 3;
  let retries = 0;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  while (retries < maxRetries) {
    try {
      console.log(`Fetching country and timezone for IP: ${ip}`);
      const response = await axios.get(`https://get.geojs.io/v1/ip/country/${ip}`);
      console.log(`Response from ipinfo.io for IP: ${ip}`, response.data);
      const data = { country: response.data.country, timezone: response.data.timezone };
      ipInfoCache.set(ip, data);
      return data;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        retries += 1;
        console.log(`Rate limit exceeded. Retry attempt ${retries}`);
        await delay(retries * 1000); // Exponential backoff
      } else {
        console.error('Error fetching country and timezone:', error.message);
        break;
      }
    }
  }
  return { country: null, timezone: null };
};

// Middleware to add country and timezone to req.user object
app.use((req, res, next) => {
  req.user = {}; // Initialize req.user
  const clientIP = getClientIP(req);
 // console.log('Client IP:', clientIP);
  getCountryAndTimezone(clientIP)
    .then(({ country, timezone }) => {
      req.user.country = country;
      req.user.timezone = timezone;
      //console.log('Country:', country, 'Timezone:', timezone); // Log country and timezone
      next();
    })
    .catch(err => {
      console.error('Error getting country and timezone:', err.message);
      req.user.country = null;
      req.user.timezone = null; // handle appropriately
      next();
    });
});

app.get('/get-country-and-timezone', (req, res) => {
  const { country, timezone } = req.user;
  if (country && timezone) {
    res.json({ country, timezone });
    console.log('Country and timezone returned to client:', country, timezone);
  } else {
    res.status(500).json({ error: 'Country and timezone not available' });
  }
});


// Define a secret key for JWT
const JWT_SECRET_KEY = process.env.JWT_SECRET || "defaultSecretKey"; // Fallback to a default value, for testing purposes

// Middleware to redirect direct access to /account-center/signin-identifier
app.use((req, res, next) => {
  if (req.path === "/account-center/signin-identifier" && !req.query.context) {
    // If the user is not logged in, redirect to /account-center/proxy to generate token
    if (!req.session.user) {

      const client_ip = getClientIP(req);
      const mode = "customsutlogin";
      const scope = "openid";

      if (!client_ip || !scope || !mode) {
        return res.status(400).send("Missing required parameters");
      }

      const token = jwt.sign({ client_ip, scope, mode }, JWT_SECRET_KEY, {
        expiresIn: "1h", // The token expires in 1 hour
      });

      // Constructing the redirect URL for user to see in the browser
      const finalRedirectUrl = `/account-center/proxy?context=${token}&client_ip=${client_ip}`;

      // Redirecting user to /account-center/proxy with the context token and client IP
      return res.redirect(finalRedirectUrl);
    }
  }
  next();
});


// Endpoint to generate JWT token and redirect to signin-identifier
app.get("/account-center/proxy", (req, res) => {
  const { context, client_ip } = req.query;

  if (!context || !client_ip) {
    return res.status(400).send("Missing context or client_ip parameters");
  }

   // Additional check: If the user session is already valid, skip token verification
   if (req.session && req.session.user && req.session.user.passkeyVerified === true) {
    // Optionally, you could trust the existing session and avoid re‑verifying the token.
    return res.redirect(`/account-center/signin-identifier?context=${context}&client_ip=${client_ip}`);
  }

  // Verify the token and get the decoded information
  try {
    // Verify the token and get the decoded information
    const decoded = jwt.verify(context, JWT_SECRET_KEY);

    // Only store user information in session if not already authenticated
    // if (!req.session.user) {
    //   req.session.user = decoded;
    // }

    // Serve a simple HTML with JavaScript to perform the delayed redirect with loader
    res.send(`
      <!doctype html>
      <html>
        <head>
          <title>Redirecting...</title>
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #f0f0f0;
            }
            .loader {
              border: 8px solid #f3f3f3; /* Light grey */
              border-top: 8px solid #3498db; /* Blue */
              border-radius: 50%;
              width: 50px;
              height: 50px;
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .overlay {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent black */
              z-index: 1000;
              display: flex;
              justify-content: center;
              align-items: center;
            }
          </style>
        </head>
        <body>
          <div class="overlay">
            <div class="loader"></div>
          </div>
          <script>
            setTimeout(() => {
              window.location.href = "/account-center/signin-identifier?context=${context}&client_ip=${client_ip}";
            }, 1000); // 1 second delay
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    return res.status(401).send("Invalid Token");
  }
});


// Middleware to validate token and redirect to signin-identifier
// const validateTokenMiddleware = (req, res, next) => {
//   const token = req.query.context;

//   if (!token) {
//     req.session.user = null;
//     const client_ip = getClientIP(req);
//     const mode = "customsutlogin";
//     const scope = "openid";

//     if (!client_ip || !scope || !mode) {
//       return res.status(400).send("Missing required parameters");
//     }

//     const newToken = jwt.sign({ client_ip, scope, mode }, JWT_SECRET_KEY, {
//       expiresIn: "1h",
//     });

//     const finalRedirectUrl = `/account-center/proxy?context=${newToken}&client_ip=${client_ip}`;
//     return res.redirect(finalRedirectUrl);
//   }

//   try {
//     const decoded = jwt.verify(token, JWT_SECRET_KEY);
//     req.user = decoded;
//     next();
//   } catch (err) {
//     return res.status(401).send("Invalid Token");
//   }
// };


// Updated middleware that does not modify the session if unauthenticated.
app.use((req, res, next) => {
  if (req.session && req.session.user &&
      req.session.user.passkeyVerified === true &&
      req.session.user.accessTokenVerified === true &&
      req.session.user.callbackTokenVerified === true) {
    return next();
  }
  // Do not modify the session if there's no valid user.
  next();
});

// Safe checkSessionMiddleware: 
const checkSessionMiddleware = (req, res, next) => {
  // If session object exists and has a valid user, redirect.
  if (
    req.session &&
    req.session.user &&
    req.session.user.passkeyVerified === true &&
    req.session.user.accessTokenVerified === true &&
    req.session.user.callbackTokenVerified === true
  ) {
    return res.redirect("/v1/portal/csutc/dashboard");
  } else {
    // Just clear user if the session exists.
    // if (req.session) {
    //   req.session.user = null;
    // }
    next();
  }
};

// Middleware to redirect direct access to /account-center/signin-identifier
app.use("/account-center/signin-identifier", checkSessionMiddleware);

// Apply the token validation middleware to the signin-identifier route
app.get("/account-center/signin-identifier", checkSessionMiddleware, (req, res) => {
  try {
    if (req.session && 
      req.session.user &&
      req.session.user.passkeyVerified === true &&
      req.session.user.accessTokenVerified === true &&
      req.session.user.callbackTokenVerified === true) {
      return res.redirect("/v1/portal/csutc/dashboard");
    }
    res.sendFile(path.join(__dirname, "public", "signin-identifier.html"));
  } catch (error) {
    console.error("Error serving sign-in form:", error);
    res.status(500).send("Error serving sign-in form.");
  }
});

app.get("/", (req, res) => {
  if (
    req.session && 
    req.session.user &&
    req.session.user.passkeyVerified === true &&
    req.session.user.accessTokenVerified === true &&
    req.session.user.callbackTokenVerified === true
  ) {
    res.redirect("/v1/portal/csutc/dashboard");
  } else if (req.session.notificationAccessAllowed || req.session.allowedAccess) {
    // Allow access to /identity/account/registration/confirmation if notificationAccessAllowed is true
    res.redirect("/identity/account/registration/confirmation");
  } else {
    req.session.user = null;
    req.session.notificationAccessAllowed = null; // Clear the flag
    res.redirect("/account-center/signin-identifier");
  }
});




// Middleware to serve static files from the React app
app.use('/admin', express.static(path.join(__dirname, './admin-dashboard/client/build')));

// Use the admin app's routes for API endpoints
app.use('/admin/api/', adminSessionMiddleware, adminApp); // Change to /admin/api to match your fetch request

// Catch-all route to serve React app for SPA routing
app.get('/admin/*', adminSessionMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, './admin-dashboard/client/build', 'index.html'), (err) => {
    if (err) {
      console.error(`Error sending index.html for /admin/*: ${err.message}`);
      res.status(500).send('Internal Server Error');
    }
  });
});

// Catch-all route for handling 404 errors
// 404 error handling for undefined routes
app.use((req, res, next) => {
  if (
    req.path.startsWith('/client') ||
    req.path.startsWith('/admin') ||
    req.path.startsWith('/client/api') ||
    req.path.startsWith('/admin/api') ||
    req.path.startsWith('/header-and-navigation')
  ) {
    next();
  } else {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'), (err) => {
      if (err) {
        console.error(`Error sending 404.html: ${err.message}`);
        res.status(500).send('Internal Server Error');
      }
    });
  }
});

// General error handling middleware
app.use((err, req, res, next) => {
  console.error(`Error occurred: ${err.message}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500,
    },
  });
});




//////////////////////////////////////////////header and navigation ###############################33

// Shopify API credentials


try {
  await import('./admin-dashboard/server/index.js');
  console.log('Backend routes loaded successfully.');
} catch (error) {
  console.error('Error loading backend routes:', error);
  // Exit the process so that the parent's fork exit listener will restart the child.
  process.exit(1);
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
   // Schedule the connection check every 30 seconds
   setInterval(checkConnections, 30000);
});
} catch (error) {
console.error('Failed to start server:', error);
process.exit(1); // Exit the process with an error code so the parent can restart.
}
};

startServer();

// Global error handling to catch any unhandled exceptions/rejections.
process.on('uncaughtException', (error) => {
console.error('Uncaught exception:', error);
process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
console.error('Unhandled rejection at:', promise, 'reason:', reason);
process.exit(1);
});
}