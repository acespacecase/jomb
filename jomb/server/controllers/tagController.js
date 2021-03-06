const mongoose = require("mongoose");
const Tag = require("../models/tag");
const Book = require("../models/book");

exports.getTags = async (req, res) => {
  let tags = await Tag.find({}, (err, tags) => {
    if (err) return res.json({ message: "Error retrieving all tags." });
    res.json(tags);
  });
};

exports.findOrCreateTag = name => {
  return new Promise(async (resolve, reject) => {
    try {
      let tag = await Tag.findOne({ name });

      if (!tag) {
        tag = await new Tag({ name }).save();
      }
      resolve(tag);
    } catch (error) {
      reject(error);
    }
  });
};

exports.addTag = async (req, res) => {
  let tag = await new Tag(req.body).save((err, tag) => {
    if (err) return res.json({ message: "Error adding new tag." });
    res.json({ message: "Tag successfully added!", tag });
  });
};

exports.deleteTag = async (req, res) => {
  let tag = await Tag.deleteOne({ _id: req.params.id }, err => {
    if (err) {
      return res.json({ message: "Error deleting that tag." });
    }
  });
};
