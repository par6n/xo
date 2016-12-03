/**
 * Application init file
 */
module.exports = () => {
    // Load required modules
    const bodyParser = require( 'body-parser' ),
          Helmet = require( 'helmet' );

    // Enable parser
    app.use( bodyParser.urlencoded( { extended: true } ) );

    // Static serving
    app.use( '/static', require( 'express' ).static( `${process.cwd()}/static` ) );

    // Wear the Helmet!
    app.use( Helmet() );

    // Introduce the models 
    global.Models = {
        Game:           require( './models/Game' ),
        Player:         require( './models/Player' )
    };

    // Apply the routes
    require( './routes' )();

    // Setup IO handlers
    require( './io' );
};