const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var projRequest = new Schema({
    name : String,
    Author : String,
    email : String,
    submitted : Date,
    description: String
});

mongoose.model("projRequest", projRequest);
