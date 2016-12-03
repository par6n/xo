$( function() {
    var status = 'identifying',
        playerName,
        socket = io();
    
    // Hooking on SocketIO messages
    socket.on( 'error message', ( msg ) => {
        $( '#playerStatus' ).attr( 'class', 'error' ).html( msg );
    } );
    
    // Initialize particleground
    particleground( document.getElementById( 'pageBG' ), {
        proximity:          100,
        density:            14000,
        minSpeedX:          0.5,
        minSpeedY:          0.3
    } );

    $( '.play' ).click( function( e ) {
        e.preventDefault();
        $( 'article' ).fadeOut( 400 );
        $( 'h4' ).fadeOut( 400, function() {
            $( 'main' ).animate( {
                top:        '15%'
            }, function() {
                $( '#playground' ).fadeIn( 400 );
                startPlaying();
            } );
        } );
    } );

    var startPlaying = function() {
        // 1. Identify the player 
        if ( typeof( Storage ) == 'undefined' ) {
            $( '#playerStatus' ).html( "Snaps! Your browser doesn't support local storage! Use a modern browser." );
            $( '.spinner' ).slideUp( 400 );
            $( '#playerStatus' ).attr( 'class', 'error' );
            return;
        }

        var playerId = localStorage.getItem( 'playerID' );
        if ( ! playerId ) {
            $( '#askPlayerName' ).slideDown( 400 );
            $( '#gameStatus' ).slideUp( 400 );
            status = 'askPlayer';
            return;
        }

        $.ajax( {
            url:            '/api/player/check',
            method:         'POST',
            data:           { playerId: playerId }
        } ).done( function( data ) {
            if ( data.ok ) {
                playerName = data.playerName;
                $( '.spinner' ).slideDown( 400 );
                $( '#playerStatus' ).attr( 'class', 'flashing' ).html( 'Welcome, ' + playerName + '! Waiting for an opponent to get online...<br>While you are waiting, how about read about XO strategies?' );
                findAGame();
            } else {
                localStorage.removeItem( 'playerID' );
                startPlaying();
                console.log( 'checkPlayer returned non-OK', data );
            }
        } ).fail( function( err ) {
            localStorage.removeItem( 'playerID' );
            startPlaying();
            console.log( 'checkPlayer returned non-OK', err );
        } );
    };

    var findAGame = function() {
        status = 'findingGame';
        socket.emit( 'new client', localStorage.getItem( 'playerID' ) );
    };

    $( '#submitName' ).click( function() {
        if ( status != 'askPlayer' ) return alert( "-_- Ummm, not sure what you have done, but I'm sure it's wrong!" );
        var theName = $( '#inputPlayer' ).val().trim();
        if ( ! theName ) return alert( "We need a name! Not neccessary to enter your real name, nickname is fine." );
        
        $( '#askPlayerName' ).slideUp( 400 );
        $( '#gameStatus' ).slideDown( 400 );
        $( '.spinner' ).show();
        $( '#playerStatus' ).attr( 'class', 'flashing' ).html( 'Just a sec...' );

        // Submit the name...
        $.ajax( {
            url:            '/api/player/new',
            method:         'POST',
            data:           { playerName: theName }
        } ).done( function( data ) {
            if ( data.ok ) {
                localStorage.setItem( 'playerID', data.userID );
                startPlaying();
            } else {
                $( '.spinner' ).slideUp( 400 );
                $( '#playerStatus' ).attr( 'class', 'error' ).html( 'Snaps! Something went wrong. Apologize for that, see the console for further details' );
                console.error( data );
            }
        } ).fail( function( err ) {
            $( '.spinner' ).slideUp( 400 );
            $( '#playerStatus' ).attr( 'class', 'error' ).html( 'Snaps! Something went wrong. Apologize for that, see the console for further details' );
            console.error( err );
        } );
    } );

    socket.on( 'join game', function( gameId ) {
        socket.emit( 'begin joining', { game: gameId, player: localStorage.getItem( 'playerID' ) } );
        $( '#gameStatus' ).slideUp( 400 );
        $( '#playFrame' ).slideDown( 400 );
    } );
    socket.on( 'begin join result', function( gameData ) {
        var players = '<span class="x">X</span>: ';
        if ( ! gameData.ok ) {
            $( '#xoStatus' ).attr( 'class', 'error' ).html( 'Snaps -_- Something came up! See the console for further details.' );
            console.error( gameData.error );
            return;
        }
        $( '#turnStatus' ).html( "It's your opponent turn" );
        if ( gameData.players.X.isYou ) { 
            players += 'You / <span class="o">O</span>: ';
            $( '#turnStatus' ).html( "It's your turn" );
        }
        else players += gameData.players.X.name + ' / <span class="o">O</span>: ';
        if ( gameData.players.O.isYou ) players += 'You';
        else players += gameData.players.O.name;
        $( '#xoStatus' ).html( players );
        status = 'game ready';
    } );

    $( '.cell' ).click( function() {
        var cellID = $( this ).attr( 'id' );
        if ( $( this ).text == 'X' || $( this ).text == 'O' ) return;
        if ( status != 'game ready' ) return;
        socket.emit( 'player movement', cellID );
    } );

    socket.on( 'movement', function( data ) {
        var by = '<span class="x">X</span>';
        if ( data.by == 'O' ) by = '<span class="o">O</span>';
        $( '#' + data.cell ).html( by );
    } );
    socket.on( 'turn change', function( playerTurn ) {
        if ( localStorage.getItem( 'playerID' ) == playerTurn ) {
            $( '#turnStatus' ).html( "It's your turn" );
        } else {
            $( '#turnStatus' ).html( "It's your opponent turn" );
        }
    } );
    socket.on( 'game result', function( result ) {
        status = 'game finished';
        if ( result == 'tie' ) {
            $( '#turnStatus' ).html( "It's a tie!" );
        } else {
            var winner = result.replace( /won:/, '' );
            $( '#turnStatus' ).html( winner + " won the game!" );
        }
        $( '#controls' ).slideDown( 400 );
    } );
    $( '#repeat' ).click( function() {
        if ( status != 'game finished' || status == 'game is repeating' ) return alert( "Can't do bro." );
        socket.emit( 'request repeat', 'please!' );
        $( '.cell' ).html( '' );
        status = 'game is repeating';
        $( '#repeat' ).html( 'Repeating...' );
        $( '#repeat' ).attr( 'disabled', true );
    } );
    socket.on( 'repeat finished', function() {
        status = 'game finished';
        $( '#repeat' ).html( 'Repeat' );
        $( '#repeat' ).attr( 'disabled', false );
    } );
} );