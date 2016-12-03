const Mongoose = require( 'mongoose' ),
      Schema = Mongoose.Schema,
      ObjectId = Mongoose.ObjectId;
/**
 * Player schema definition
 */
var PlayerSchema = new Schema( {
    dateRegistered:         Date,
    IP:                     String,
    name:                   String    
} );

module.exports = Mongoose.model( 'player', PlayerSchema );