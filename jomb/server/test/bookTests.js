process.env.NODE_ENV = "test";

const mongoose = require("mongoose");
const chai = require("chai");
const chaiHttp = require("chai-http");
const server = require("../server");
const should = chai.should();

const Book = require("../models/book");
const Tag = require("../models/tag");
const ChangeHistory = require("../models/changeHistory");
const BookLocation = require("../models/location");
const { ADD } = require("../models/constants");

chai.use(chaiHttp);

describe("Books", () => {
  beforeEach(done => {
    Promise.all([
      Book.remove().exec(),
      Tag.remove().exec(),
      ChangeHistory.remove().exec(),
      BookLocation.remove().exec()
    ]).then(() => done(), done);
  });

  describe("Get books", () => {
    it("should get all existing books", done => {
      chai
        .request(server)
        .get("/api/book")
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.have.lengthOf(0);
          done(err);
        });
    });
  });

  describe("Get book", () => {
    it("should get a single book by id", done => {
      let book = new Book({
        title: "book",
        authors: ["author"],
        isbn: "123"
      });

      book.save((err, book) => {
        chai
          .request(server)
          .get(`/api/book/${book._id}`)
          .end((err, res) => {
            res.body.should.have.property("title").eql(book.title);
            res.body.should.have.property("authors").contains(book.authors[0]);
            res.body.should.have.property("isbn").eql(book.isbn);
            done(err);
          });
      });
    });
  });

  describe("Add book", () => {
    it("should add a new book", done => {
      chai
        .request(server)
        .post("/api/book")
        .send({ isbn: "9781986431484" })
        .end((err, res) => {
          res.body.transportToUI.should.have
            .property("message")
            .eql("Book successfully added!");
          res.body.changeHistory.should.have.property("message");
          res.body.transportToUI.should.have.property("book").property("title");
          res.body.transportToUI.should.have
            .property("book")
            .property("authors");
          res.body.transportToUI.should.have.property("book").property("isbn");
          done(err);
        });
    });

    it("should not add a book missing an isbn", done => {
      chai
        .request(server)
        .post("/api/book")
        .send({ isbn: "" })
        .end((err, res) => {
          res.body.should.have
            .property("message")
            .eql("There was an error adding that book.");
          done(err);
        });
    });

    it("should add a tag to a new book", done => {
      chai
        .request(server)
        .post("/api/book")
        .send({ isbn: "9781986431484" })
        .end((err, res) => {
          chai
            .request(server)
            .post(`/api/addTag/book/${res.body.transportToUI.book._id}`)
            .send({ tag: "tag" })
            .end((err2, res2) => {
              res2.body.transportToUI.book.should.have
                .property("tags")
                .length(1);
              done(err2);
            });
        });
    });

    it("should add a location to a new book", done => {
      let location = new BookLocation({
        nickname: "bookshelf",
        locationType: "living room"
      });

      location.save((err, location) => {
        let book = {
          isbn: "9781986431484",
          location: [location._id]
        };

        chai
          .request(server)
          .post("/api/book")
          .send(book)
          .end((err, res) => {
            res.body.should.not.have.property("errors");
            res.body.transportToUI.book.should.have
              .property("location")
              .contains(location._id.toString());
            done(err);
          });
      });
    });
  });

  describe("Delete book", () => {
    it("should delete a book", done => {
      chai
        .request(server)
        .post("/api/book")
        .send({ isbn: "9781986431484" })
        .end((err, res) => {
          chai
            .request(server)
            .delete("/api/book/" + res.body.transportToUI.book._id)
            .end((err, res) => {
              res.body.transportToUI.should.have
                .property("message")
                .eql("Book successfully deleted");
              done(err);
            });
        });
    });

    it("should persist change history item after its book is deleted", done => {
      chai
        .request(server)
        .post("/api/book")
        .send({ isbn: "9781986431484" })
        .end((err, res) => {
          chai
            .request(server)
            .delete(`/api/book/${res.body.transportToUI.book._id}`)
            .end((err, res) => {
              chai
                .request(server)
                .get("/api/changeHistory")
                .end((err, res) => {
                  res.body.should.not.have.property("errors");
                  res.body.should.have.lengthOf(2);
                  res.body[0].should.have.property("description").eql(ADD);
                  done(err);
                });
            });
        });
    });
  });

  describe("Update book", () => {
    it("should update an existing book", done => {
      chai
        .request(server)
        .post("/api/book")
        .send({ isbn: "9781986431484" })
        .end((err, res) => {
          let book = res.body.transportToUI.book;
          book.title = "Changed title";

          chai
            .request(server)
            .post(`/api/book/${book._id}`)
            .send(book)
            .end((err, res) => {
              res.body.transportToUI.should.have.property("book");
              res.body.transportToUI.book.should.have
                .property("title")
                .eql(book.title);
              done(err);
            });
        });
    });

    it("should add a rating to a book", done => {
      chai
        .request(server)
        .post("/api/book")
        .send({ isbn: "9781986431484" })
        .end((err, res) => {
          let book = res.body.transportToUI.book;
          book.rating = 5;

          chai
            .request(server)
            .post(`/api/book/${res.body.transportToUI.book._id}/${book.rating}`)
            .end((err, res) => {
              res.body.transportToUI.should.have.property("book");
              res.body.transportToUI.book.should.have
                .property("rating")
                .eql(book.rating);
              done(err);
            });
        });
    });

    it("should not add an invalid rating to a book", done => {
      chai
        .request(server)
        .post("/api/book")
        .send({ isbn: "9781986431484" })
        .end((err, res) => {
          let book = res.body.transportToUI.book;
          book.rating = 15;

          chai
            .request(server)
            .post(`/api/book/${res.body.transportToUI.book._id}/${book.rating}`)
            .end((err, res) => {
              res.body.should.have
                .property("message")
                .eql("Error rating book.");
              done(err);
            });
        });
    });
  });
});
