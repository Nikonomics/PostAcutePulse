const db = require("../models");
const sequelize = require("sequelize");
const config = require("./config");
const path = require("path");
var uuid = require("uuid");
var randomstring = require("randomstring");
// var fetch = require("node-fetch");
// const cryptLib = require('@skavinvarnan/cryptlib');

const KEY = process.env.ENCRYPTION || "";

module.exports = {
  // generate unique id:
  generateUniqueId: () => {
    return uuid.v4();
  },

  validateObject: async (required, non_required) => {
    let message = "";
    let empty = [];

    let model =
      required.hasOwnProperty("model") && db.hasOwnProperty(required.model)
        ? db[required.model]
        : db.users;

    for (let key in required) {
      if (required.hasOwnProperty(key)) {
        if (
          required[key] == undefined ||
          (required[key] === "" &&
            (required[key] !== "0" || required[key] !== 0))
        ) {
          empty.push(key);
        }
      }
    }

    if (empty.length != 0) {
      message = empty.toString();
      if (empty.length > 1) {
        message += " fields are required";
      } else {
        message += " field is required";
      }
      throw {
        code: 400,
        message: message,
      };
    } else {
      if (required.hasOwnProperty("securitykey")) {
        if (required.securitykey != "ads") {
          message = "Invalid security key";
          throw {
            code: 400,
            message: message,
          };
        }
      }
      // if (required.hasOwnProperty('password')) {
      //     required.password = module.exports.createSHA1Hash(required.password);
      // }

      if (required.hasOwnProperty("checkExists") && required.checkExists == 1) {
        const checkData = {
          email: "Email already exists, kindly use another.",
          phone: "Phone number already exists, kindly use another",
        };

        for (let key in checkData) {
          if (required.hasOwnProperty(key)) {
            const checkExists = await model.findOne({
              where: {
                [key]: required[key].trim(),
              },
            });
            if (checkExists) {
              throw {
                code: 400,
                message: checkData[key],
              };
            }
          }
        }
      }

      const merge_object = Object.assign(required, non_required);
      delete merge_object.checkexit;
      delete merge_object.securitykey;

      if (
        merge_object.hasOwnProperty("password") &&
        merge_object.password == ""
      ) {
        delete merge_object.password;
      }

      for (let data in merge_object) {
        if (merge_object[data] == undefined) {
          delete merge_object[data];
        } else {
          if (typeof merge_object[data] == "string") {
            merge_object[data] = merge_object[data].trim();
          }
        }
      }

      return merge_object;
    }
  },

  unauth: function (res, err, body = {}) {
    console.log(err, "===========================>error");
    let code = typeof err === "object" ? (err.code ? err.code : 401) : 401;
    let message =
      typeof err === "object" ? (err.message ? err.message : "") : err;
    res.status(code).json({
      success: false,
      code: code,
      message: message,
      body: body,
    });
  },

  success: function (res, message = "", body = {}) {
    return res.status(200).json({
      success: true,
      code: 200,
      message: message,
      body: body,
    });
  },

  error: function (res, err, body = {}) {
    console.log(err, "===========================>error");
    let code = typeof err === "object" ? (err.code ? err.code : 200) : 400;
    let message =
      typeof err === "object" ? (err.message ? err.message : "") : err;
    res.status(200).json({
      success: false,
      code: code,
      message: message,
      body: body,
    });
  },

  fileUpload: (file, parentFolder = "") => {
    let file_name_string = file.name;
    var file_name_array = file_name_string.split(".");
    var file_extension = file_name_array[file_name_array.length - 1];
    var result = "";
    result = Math.floor(Date.now() / 1000);
    let name = result + "." + file_extension;
    file.mv(process.cwd() + `/../public/images/${name}`, function (err) {
      if (err) throw err;
    });
    return name;
  },

  multipleFileUpload: (files, parentFolder = "") => {
    let names = [];
    attachment = files;
    console.log(" attachment.length  ", attachment.length);
    if (attachment.length > 1) {
      attachment.forEach((file) => {
        let file_name_string = file.name;
        var file_name_array = file_name_string.split(".");
        var file_extension = file_name_array[file_name_array.length - 1];
        var result = "";
        result = randomstring.generate(15);
        let name = result + "." + file_extension;
        file.mv(process.cwd() + `/../public/images/${name}`, function (err) {
          if (err) throw err;
        });
        names.push(name);
      });
    } else {
      let file_name_string = attachment.name;
      var file_name_array = file_name_string.split(".");
      var file_extension = file_name_array[file_name_array.length - 1];
      var result = "";
      result = randomstring.generate(15);
      let name = result + "." + file_extension;
      attachment.mv(
        process.cwd() + `/../public/images/${name}`,
        function (err) {
          if (err) throw err;
        }
      );
      names.push(name);
    }
    return names;
  },

  getQuarterDateRangeUTC: (offset = 0) => {
    const now = new Date();
    const currentQuarter = Math.floor(now.getUTCMonth() / 3);
    const adjustedQuarter = (currentQuarter + offset + 4) % 4;
    const yearAdjustment = Math.floor((currentQuarter + offset) / 4);
    const year = now.getUTCFullYear() + yearAdjustment;

    const startMonth = adjustedQuarter * 3;
    const startDate = new Date(Date.UTC(year, startMonth, 1)); // UTC start
    const endDate = new Date(Date.UTC(year, startMonth + 3, 0)); // UTC end

    return { startDate, endDate };
  },

  // otpSent: (email, name, otp) => {
  //     let url = 'https://api.brevo.com/v3/smtp/email';
  //     let options = {
  //         method: 'POST',
  //         headers: {
  //             Accept: 'application/json',
  //             'Content-Type': 'application/json',
  //             'api-key': process.env.SENDINBLUE_KEY
  //         },
  //         body: JSON.stringify({
  //             sender: { name: 'SportX', email: 'no-reply@techangouts.com' },
  //             to: [{ email: email }],
  //             replyTo: { email: 'no-reply@techangouts.com', name: 'No-Reply' },
  //             htmlContent: '<div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2"><div style="margin:50px auto;width:70%;padding:20px 0"><div style="border-bottom:1px solid #eee"><a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">SportX</a></div><p style="font-size:1.1em">Hi, ' +name +' </p><p>Thank you for choosing SportX. Use the following otp to complete your Account recovery procedure .</p><h2 style="background: #00466a;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">' +otp +'</h2><p style="font-size:0.9em;">Regards,<br />SportX</p><hr style="border:none;border-top:1px solid #eee" /><div style="float:right;padding:8px 0;color:#aaa;font-size:0.8em;line-height:1;font-weight:300"></div></div></div>',
  //             subject: 'Otp for SportX'
  //         })
  //     };
  //     return fetch(url, options)
  //         .then(res => res.json())
  //         .then(json => console.log(json))
  //         .catch(err => console.error('error:' + err));
  // },

  // forgotpassword: (email, name, password) => {
  //     let url = 'https://api.brevo.com/v3/smtp/email';
  //     let options = {
  //         method: 'POST',
  //         headers: {
  //             Accept: 'application/json',
  //             'Content-Type': 'application/json',
  //             'api-key': process.env.SENDINBLUE_KEY
  //         },
  //         body: JSON.stringify({
  //             sender: { name: 'SportX', email: 'no-reply@techangouts.com' },
  //             to: [{ email: email }],
  //             replyTo: { email: 'no-reply@techangouts.com', name: 'No-Reply' },
  //             htmlContent: '<div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2"><div style="margin:50px auto;width:70%;padding:20px 0"><div style="border-bottom:1px solid #eee"><a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">SportX</a></div><p style="font-size:1.1em">Hi, ' +name +' </p><p>Thank you for choosing SportX. Use the following password to complete your Account recovery procedure .</p><h2 style="background: #00466a;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">' +password +'</h2><p style="font-size:0.9em;">Regards,<br />SportX</p><hr style="border:none;border-top:1px solid #eee" /><div style="float:right;padding:8px 0;color:#aaa;font-size:0.8em;line-height:1;font-weight:300"></div></div></div>',
  //             subject: 'Forgot password SportX'
  //         })
  //     };
  //     return fetch(url, options)
  //         .then(res => res.json())
  //         .then(json => console.log(json))
  //         .catch(err => console.error('error:' + err));
  // },
};
