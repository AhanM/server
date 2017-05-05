const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const projRequestSchema = new Schema({
  name : String,
  Author : String,
  email : String,
  submitted : Date,
  description: String,
  stars: Number,
  approved: Boolean
}, { collection: 'projects' }); // uses the projects collection name

const projRequest = mongoose.model('projRequest', projRequestSchema);

module.exports = projRequest;
