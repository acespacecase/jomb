const mongoose = require("mongoose");
const Book = require("../models/book");
const ChangeHistory = require("../models/changeHistory");
const changeHistoryController = require("./changeHistoryController");
const tagController = require("./tagController");
const {
  ADD,
  DELETE,
  UPDATE,
  RATE,
  DUPLICATE_KEY_ERROR,
  NO_DATA,
  GENERAL_ERROR,
  SUCCESS,
  BOOK_STATUS_OPTIONS
} = require("../models/constants");
const axios = require("axios");

exports.getBooks = async (req, res) => {
  await Book.find({})
    .sort({ title: "asc" })
    .exec((err, books) => {
      if (err) return res.json({ message: "Error retrieving all books." });
      res.json(books);
    });
};

exports.getBook = async (req, res) => {
  await Book.findOne({ _id: req.params.id })
    .populate("tags")
    .exec((err, book) => {
      if (err) {
        return res.json({
          message: "Sorry, we could not find that book. Please try again."
        });
      }
      return res.json(book);
    });
};

exports.addBook = async (req, res, next) => {
  let isbn = req.body.isbn;
  axios(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
    .then(data => {
      if (data.data.totalItems === 0) {
        return res.json({
          errorNumber: NO_DATA,
          message: "We can't find that book, try another IBSN"
        });
      }

      let bookInfo = data.data.items[0].volumeInfo;
      let book = new Book(req.body);

      book.title = bookInfo.title || "";
      book.authors = bookInfo.authors || [];

      book.save((err, book) => {
        if (err) {
          if (err.code === DUPLICATE_KEY_ERROR) {
            return res.json({
              errorNumber: DUPLICATE_KEY_ERROR,
              message: "You've already added a book with that ISBN"
            });
          } else {
            return res.json({
              errorNumber: GENERAL_ERROR,
              message: "There was an error adding that book."
            });
          }
        }
        req.transportToUI = {
          errorNumber: SUCCESS,
          message: "Book successfully added!",
          book
        };
        req.changeHistoryData = {
          description: ADD,
          detail: "Added book to library",
          bookId: book._id
        };
        next();
      });
    })
    .catch(err => {
      return err;
    });
};

exports.deleteBook = async (req, res, next) => {
  await Book.deleteOne({ _id: req.params.id }, (err, book) => {
    if (err) {
      return res.json({
        errorNumber: GENERAL_ERROR,
        message: "There was an error deleting this book. Please try again."
      });
    }

    req.transportToUI = {
      errorNumber: SUCCESS,
      message: "Book successfully deleted",
      book: {
        _id: req.params.id
      }
    };

    req.changeHistoryData = {
      description: DELETE,
      detail: "Deleted book from library",
      bookId: req.params.id
    };

    next();
  });
};

exports.updateBook = async (req, res, next) => {
  await Book.findOneAndUpdate(
    { _id: req.params.id },
    req.body,
    { new: true },
    (err, book) => {
      if (err) {
        return res.json({
          message:
            "Sorry, there was an error updating this book. Please try again."
        });
      }

      req.transportToUI = {
        errorNumber: SUCCESS,
        message: "Book successfully updated",
        book
      };

      req.changeHistoryData = {
        description: UPDATE,
        detail: "Updated book",
        bookId: book._id
      };

      next();
    }
  ).catch(err => {
    return err;
  });
};

exports.addTagToBook = async (req, res, next) => {
  if (!req.body.tag || req.body.tag === "") {
    return res.json({
      message: `Sorry, there was an error adding a tag [${
        req.body.tag
      }] to this book. Please try again.`
    });
  }

  let tag = await tagController.findOrCreateTag(req.body.tag);

  await Book.findOneAndUpdate(
    { _id: req.params.id },
    { $addToSet: { tags: tag._id } },
    { new: true }
  )
    .populate("tags")
    .exec((err, book) => {
      if (err) {
        return res.json({
          message:
            "Sorry, there was an error updating this book. Please try again."
        });
      }

      req.transportToUI = {
        errorNumber: SUCCESS,
        message: "Book successfully updated",
        book
      };

      req.changeHistoryData = {
        description: UPDATE,
        detail: `Added the ${tag.name} tag`,
        bookId: book._id
      };

      next();
    });
};

exports.removeTagFromBook = async (req, res, next) => {
  if (!req.body.tag || req.body.tag === "") {
    return res.json({
      message: `Sorry, there was an error removing a tag [${
        req.body.tag
      }] to this book. Please try again.`
    });
  }

  await Book.findOneAndUpdate(
    { _id: req.params.id },
    { $pullAll: { tags: [req.body.tag._id] } },
    { new: true }
  )
    .populate("tags")
    .exec((err, book) => {
      if (err) {
        return res.json({
          message:
            "Sorry, there was an error removing that tag. Please try again."
        });
      }

      req.transportToUI = {
        errorNumber: SUCCESS,
        message: "Book successfully updated",
        book
      };

      req.changeHistoryData = {
        description: UPDATE,
        detail: `Removed the ${req.body.tag.name} tag`,
        bookId: req.params.id
      };

      next();
    });
};

exports.rateBook = async (req, res, next) => {
  const bookId = req.params.id;
  const rating = req.params.rating;

  await Book.findOneAndUpdate(
    { _id: bookId },
    { rating },
    { new: true, runValidators: true },
    (err, book) => {
      if (err) {
        return res.json({ message: "Error rating book." });
      }

      req.transportToUI = {
        errorNumber: SUCCESS,
        message: "Book successfully rated",
        book
      };

      req.changeHistoryData = {
        description: RATE,
        detail: `Rated book ${rating} stars`,
        bookId: book._id
      };

      next();
    }
  ).catch(err => {
    return err;
  });
};

exports.addLocationToBook = async (req, res, next) => {
  const bookId = req.params.id;
  const location = req.params.location;
};

exports.updateStatus = async (req, res, next) => {
  if (
    req.body.status &&
    req.body.status !== "" &&
    BOOK_STATUS_OPTIONS.includes(req.body.status)
  ) {
    await Book.findOneAndUpdate(
      { _id: req.params.id },
      { status: req.body.status },
      { new: true }
    )
      .populate("tags")
      .exec((err, book) => {
        if (err) {
          return res.json({
            message:
              "Sorry, there was an error updating the status of this book. Please try again."
          });
        }

        req.transportToUI = {
          errorNumber: SUCCESS,
          message: "Book successfully updated",
          book
        };

        req.changeHistoryData = {
          description: UPDATE,
          detail: `Updated the status to ${book.status}`,
          bookId: req.params.id
        };

        next();
      });
  } else {
    return res.json({
      message: `Sorry, there was an error updating this book. Please try again.`
    });
  }
};
