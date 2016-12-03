/**
 * Setup SocketIO handlers
 */
global.currentGames = {};

io.on( 'connection', ( socket ) => {
    socket.on( 'new client', ( playerId ) => {
        socket.playerId = playerId;
        // Check for any pending game...
        Models.Game.findOne( { status: 'waiting' }, ( err, game ) => {
            if ( err ) {
                socket.emit( 'error message', 'Snaps! Unexpected 500 error!' );
                return;
            }
            if ( game && game.players.indexOf( playerId ) == -1 ) {
                game.players.push( playerId );
                game.markModified( 'players' );
                game.status = 'active';
                game.save( () => {
                    socket.join( 'game:' + game._id );
                    io.to( 'game:' + game._id ).emit( 'join game', game._id );
                } );
            } else {
                if ( game ) {
                    socket.join( 'game:' + game._id );
                    return;
                }
                var newGame = new Models.Game();
                newGame.dateCreated = new Date();
                newGame.status = 'waiting';
                newGame.players = [ playerId ];
                newGame.save( ( err, result ) => {
                    if ( err ) {
                        socket.emit( 'error message', 'Snaps! Unexpected 500 error!' );
                        return;
                    }
                    socket.join( 'game:' + result._id );
                } );
            }
        } );
    } );
    socket.on( 'disconnect', () => {
        var playerId = socket.playerId;
        // Make sure player isn't there anymore
        var clients = [],
            isThere = false;
        // Get a list of clients
        var ns = io.of( '/' );
        if ( ns )
            var clients = ns.connected;
        else
            var clients = [];

        for ( var client in clients ) {
            if ( ! clients[client] ) continue;
            if ( clients[client].playerId == playerId ) {
                isThere = true;
                break;
            }
        }
        
        if ( ! isThere ) {
            Models.Game.remove( { status: 'waiting', players: { $in: [ playerId ] } } ); // Remove any waiting game
        }
    } );
    socket.on( 'begin joining', function( data ) {
        var givenId = data.player,
            gameId = data.game;
        if ( givenId != socket.playerId ) {
            socket.emit( 'begin join result', { ok: false, error: 'player_id_mismatch' } );
            return;
        }
        Models.Game.findOne( { _id: gameId }, ( err, game ) => {
            if ( err ) {
                socket.emit( 'begin join result', { ok: false, error: 'error_500' } );
                return;
            }
            if ( ! game ) {
                socket.emit( 'begin join result', { ok: false, error: 'game_not_found' } );
                return;
            }
            if ( game.status != 'active' ) {
                socket.emit( 'begin join result', { ok: false, error: 'game_not_active' } );
                return;
            }
            if ( game.players.indexOf( givenId ) == -1 ) {
                socket.emit( 'begin join result', { ok: false, error: 'game_forbidden' } );
                return;
            }
            
            Models.Player.find( { _id: { $in: game.players } }, ( err, players ) => {
                if ( err ) {
                    socket.emit( 'begin join result', { ok: false, error: 'error_500' } );
                    return;
                }
                if ( ! players ) {
                    socket.emit( 'begin join result', { ok: false, error: 'players_invalid' } );
                    return;
                }
                if ( players.length != 2 ) {
                    socket.emit( 'begin join result', { ok: false, error: 'players_invalid' } );
                    return;
                }
                if ( game.players[0] != players[0]._id ) {
                    players.reverse();
                }
                if ( game.players[0] != players[0]._id ) {
                    console.log( 'WTF?' );
                }

                socket.emit( 'begin join result', {
                    ok:             true, 
                    players:        { 'X': { name: players[0].name, isYou: ( players[0]._id == givenId ), isTurn: true }, 'O': { name: players[1].name, isYou: ( players[1]._id == givenId ), isTurn: false } }
                } );
                
                currentGames[ gameId ] = game;
                currentGames[ gameId ].logs = [];
                currentGames[ gameId ].turn = players[0]._id;
                currentGames[ gameId ].fullCells = [];
                currentGames[ gameId ].cellStatus = {};
            } );
        } );
    } );

    var searchWinner = ( game ) => {
        var gs = currentGames[ game ].cellStatus;
        var result = 0;
        //console.log( gs );
        // Vertically
        if ( ( gs.a1 == gs.b1 ) && ( gs.a1 == gs.c1 ) ) result = gs.a1;
        if ( ( gs.a2 == gs.b2 ) && ( gs.a2 == gs.c2 ) ) result = gs.a2;
        if ( ( gs.a3 == gs.b3 ) && ( gs.a3 == gs.c3 ) ) result = gs.a3;
        // Horizontally
        if ( ( gs.a1 == gs.a2 ) && ( gs.a1 == gs.a3 ) ) result = gs.a1;
        if ( ( gs.b1 == gs.b2 ) && ( gs.b1 == gs.b3 ) ) result = gs.b1;
        if ( ( gs.c1 == gs.c2 ) && ( gs.c1 == gs.c3 ) ) result = gs.c1;
        // Diaognal
        if ( ( gs.a1 == gs.b2 ) && ( gs.a1 == gs.c3 ) ) result = gs.a1;
        if ( ( gs.a3 == gs.b2 ) && ( gs.a3 == gs.c1 ) ) result = gs.a3;
        return result;
    };

    var checkResult = ( game ) => {
        var logs = currentGames[ game ].logs;
        if ( logs.length < 5 ) return 0; // no result unless <5 moves are done.
        if ( logs.length < 9 ) {
            // It can't be a tie so search for a winner.
            return searchWinner( game );
        } else {
            // There's a possibility of tie.
            var winner = searchWinner( game );
            if ( ! winner )
                return -1;
            else
                return winner;
        }
    };

    var saveGame = ( game ) => {
        Models.Game.findOne( { _id: game }, ( err, row ) => {
            if ( err ) return; //:|
            if ( ! row ) return // Wat?
            row.dateFinished = new Date();
            row.status = 'finished';
            row.results = currentGames[ game ].winner;
            row.log = currentGames[ game ].logs;
            row.markModified( 'log' );
            delete currentGames[ game ];
            row.save();
        } );
    };

    socket.on( 'player movement', ( cell ) => {
        var game;
        for( var k in socket.rooms ) {
            if ( k.substr( 0, 5 ) == 'game:' ) {
                game = k.replace( /game:/, '' );
                break;
            }
        }
        if ( ! game ) return;
        if ( ! currentGames[ game ] ) return;
        if ( currentGames[ game ].players.indexOf( socket.playerId ) == -1 ) return;
        if ( currentGames[ game ].status != 'active' ) return;
        if ( currentGames[ game ].fullCells.indexOf( cell ) != -1 ) return;
        if ( currentGames[ game ].turn != socket.playerId ) return;
        currentGames[ game ].fullCells.push( cell );
        currentGames[ game ].cellStatus[ cell ] = socket.playerId;

        var sign = 'X';
        if ( currentGames[ game ].players[1] == socket.playerId ) sign = 'O';
        currentGames[ game ].logs.push( [ cell, socket.playerId, sign ] );
        if ( currentGames[ game ].turn == currentGames[ game ].players[0] ) currentGames[ game ].turn = currentGames[ game ].players[1];
        else currentGames[ game ].turn = currentGames[ game ].players[0];
        io.to( 'game:' + game ).emit( 'movement', { by: sign, cell: cell } );
        io.to( 'game:' + game ).emit( 'turn change', currentGames[ game ].turn );
        var cr = checkResult( game );
        if ( cr ) {
            if ( cr == -1 ) {
                currentGames[ game ].status = 'finshed';
                currentGames[ game ].winner = 'tie';
                saveGame( game );
                io.to( 'game:' + game ).emit( 'game result', 'tie' );
            } else {
                currentGames[ game ].status = 'finished';
                currentGames[ game ].winner = cr;
                saveGame( game );
                var sign = 'X';
                if ( currentGames[ game ].players[1] == cr ) sign = 'O';
                io.to( 'game:' + game ).emit( 'game result', 'won:' + sign );
            }
        }
    } );

    socket.on( 'request repeat', () => {
        var game;
        for( var k in socket.rooms ) {
            if ( k.substr( 0, 5 ) == 'game:' ) {
                game = k.replace( /game:/, '' );
                break;
            }
        }
        if ( ! game ) return;
        Models.Game.findOne( { _id: game }, ( err, row ) => {
            var timeout = 0;
            for( var l of row.log ) {
                ( function( r, t ) {
                    setTimeout( function() {
                        socket.emit( 'movement', { by: r[2], cell: r[0] } );
                    }, t );
                } )( l, timeout );
                timeout += 1000;
            }
            setTimeout( () => {
                socket.emit( 'repeat finished', '!' );
            }, 1000 * row.log.length );
        } );
    } );
} );

module.exports = {};