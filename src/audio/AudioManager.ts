export type AudioEvent='gameStart'|'tileSelect'|'tileSubmit'|'opponentSubmit'|'roundWin'|'roundLose'|'roundDraw'|'nextRound'|'gameWin'|'gameLose'|'overtime'|'connectionLost'|'connectionRestored';
export class AudioManager{ play(_event:AudioEvent){/* assets intentionally not bundled yet */} }
