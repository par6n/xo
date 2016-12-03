/**
 * Application routes
 */
module.exports = () => {
    app.get( '/', ( req, resp ) => {
        resp.sendFile( __dirname + '/index.html' );
    } );

    app.post( '/api/player/new', ( req, resp ) => {
        if ( ! req.body.playerName ) return resp.status( 400 ).send( { ok: false, error: 'missing_name' } );
        var playerName = req.body.playerName,
            player = new Models.Player();
        
        player.name = playerName;
        player.IP = req.ip;
        player.dateRegistered = new Date();
        player.save( ( err, result ) => {
            if ( err ) {
                console.log( 'Error at newplayer: ', err );
                return resp.send( 500 ).status( { ok: false, error: 'Unexpected 500 error!' } );
            }
            resp.send( { ok: true, userID: result._id } );
        } );
    } );

    app.post( '/api/player/check', ( req, resp ) => {
        if ( ! req.body.playerId ) return resp.status( 400 ).send( { ok: false, error: 'missing_name' } );
        var playerId = req.body.playerId;
        Models.Player.findOne( { _id: playerId }, ( err, player ) => {
            if ( err ) return resp.status( 500 ).send( { ok: false, error: 'Unexpected 500 error!' } );
            if ( ! player ) return resp.status( 404 ).send( { ok: false, error: 'player_not_found' } );
            resp.send( { ok: true, playerName: player.name } );
        } );
    } );
};