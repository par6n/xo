const Mongoose = require( 'mongoose' ),
      Schema = Mongoose.Schema,
      ObjectId = Mongoose.ObjectId;
/**
 * Game schema definition
 */
var GameSchema = new Schema( {
    dateCreated:                Date,
    dateFinished:               Date,
    status:                     String,
    results:                    String,
    players:                    Object,
    log:                        Object
} );

module.exports = Mongoose.model( 'game', GameSchema );