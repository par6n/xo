'use strict'; // Enable ES6 features for older Node versions.

const Mongoose = require( 'mongoose' ), // ODM for data
      Express = require( 'express' ), // Express web server
      Log = require( 'debug' )( 'xo' ), // Logging function for debugging
      http = require( 'http' ), // Use Node HTTP
      app = Express(), // Create Express server,
      server = http.Server( app ), // Create the server
      io = require( 'socket.io' )( server ); // Setup SocketIO

console.log( 'Socket XO v' + require( './package.json' ).version + ' - Created by Ehsaan (ehsaan.me)' );

/** Application configuration */
const dbURL = process.env.MONGO_URL || 'mongodb://localhost:27017/xo',
      Port = process.env.PORT || 8080,
      SecretPhrase = 'XO by Ehsaan';
global.SecretPhrase = SecretPhrase;

/** Connect to the server */
Mongoose.Promise = global.Promise;
Mongoose.connect( dbURL );
Mongoose.connection.on( 'open', ( err ) => {
    if ( err ) throw err;
    console.log( 'Connected to MongoDB server' );
    
    server.listen( Port, () => {
        global.app = app; // Make the app available across the code.
        global.io = io; // Make IO public
        console.log( 'Application is running on port ' + Port );

        require( './src' )();
    } );
} );