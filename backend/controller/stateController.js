const { query } = require("express");
const jwt = require("jsonwebtoken");
const jwtToken = process.env.JWT_SECRET;
const bcrypt = require("bcryptjs");
let helper = require("../config/helper");
const db = require("../models");
const sequelize = require("sequelize");
const Op = sequelize.Op;

const State = db.states;

module.exports = {
  /* 
    This function will help to create state data:
    Method: Post
    Url: /api/v1/states
    Required: 
        - state_name
        - state_code
    */
  createState: async (req, res) => {
    try {
      const data = await State.create(req.body);

      // return the success response:
      return helper.success(res, "State created successfully", { id: data.id });
    } catch (error) {
      helper.error(res, error);
    }
  },

  /* 
    This function will help to fetch all states:
    Method: GET
    url: /api/v1/states
    */
  getStates: async (req, res) => {
    try {
      // applying pagination:
      const { page = 1, perPage = 10 } = req.query;

      // fetch states data:
      const data = await State.findAndCountAll({
        where: {
          status: 1,
        },
        limit: parseInt(perPage),
        offset: parseInt(perPage) * (parseInt(page) - 1),
        order: [["createdAt", "DESC"]],
      });
      if (data.count == 0) {
        return helper.success(res, "State not found", []);
      }

      // return the success response:
      return helper.success(res, "State fetched successfully", {
        data: data.rows,
        totalItems: data.count,
        totalPages: Math.ceil(data.count / parseInt(perPage)),
      });
    } catch (error) {
      helper.error(res, error);
    }
  },

  /* 
  This function will help to fetch state by id:
  Method: GET
  url: /api/v1/states/:id
  */
  getParticularState: async (req, res) => {
    try {
      // check data exists
      const data = await State.findOne({
        where: { id: req.params.id, status: 1 },
      });
      if (!data) {
        return helper.error(res, "State not found");
      }

      // return the success response
      return helper.success(res, "State fetched successfully", data);
    } catch (error) {
      helper.error(res, error);
    }
  },

  /*
  This function will help to update state by id:
  Method: PUT
  url: /api/v1/states
  */
  updateState: async (req, res) => {
    try {
      // check data exists
      const data = await State.findOne({ where: { id: req.body.id } });
      if (!data) {
        return helper.error(res, "State not found");
      }

      // update data
      await data.update(req.body);

      // return the success response
      return helper.success(res, "State updated successfully", { id: data.id });
    } catch (error) {
      helper.error(res, error);
    }
  },

  /* 
  This function will help to delete state by id:
  Method: DELETE
  url: /api/v1/states/:id
  */
  deleteState: async (req, res) => {
    try {
      // check data exists
      const data = await State.findOne({ where: { id: req.params.id } });
      if (!data) {
        return helper.error(res, "State not found");
      }

      // delete data
      await data.update({ status: 0 });

      // return the success response
      return helper.success(res, "State deleted successfully", { id: data.id });
    } catch (error) {
      helper.error(res, error);
    }
  },
};
