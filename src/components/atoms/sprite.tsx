const CR_PAL: Record<string, string> = {
  '.': 'transparent',
  '#': '#2D2A20',
  '+': '#FFD600',
  y: '#FFEDB0',
  o: '#D97706',
  p: '#9B8ACB',
  P: '#7A6AAB',
  g: '#6BBE58',
  G: '#2B5A22',
  b: '#4AA3E6',
  B: '#1D4A7A',
  r: '#DC2626',
  w: '#FFFEF5',
  s: '#A8A29E',
  e: '#059669',
  c: '#14110A',
}

interface CrSpriteProps {
  art: readonly string[]
  size?: number
  bg?: string
}

export function CrSprite({ art, size = 48, bg = '#FFFEF5' }: CrSpriteProps) {
  const cell = size / 16
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'grid',
        gridTemplateColumns: `repeat(16, ${cell}px)`,
        gridTemplateRows: `repeat(16, ${cell}px)`,
        background: bg,
        border: '1.5px solid #2D2A20',
        imageRendering: 'pixelated',
        flexShrink: 0,
      }}
    >
      {art.flatMap((row, y) =>
        [...row].map((ch, x) => (
          <div key={`${y}-${x}`} style={{ background: CR_PAL[ch] || 'transparent' }} />
        )),
      )}
    </div>
  )
}

export type PortraitId = 'human' | 'scout' | 'gatekeeper' | 'brewer' | 'patcher'

export const CR_PORTRAITS: Record<PortraitId, readonly string[]> = {
  human: [
    '................', '................', '......####......', '.....#yyyy#.....',
    '....#yy##yy#....', '....#y####y#....', '....#yyyyyy#....', '.....#yyyy#.....',
    '......####......', '.....#++++#.....', '....#+#++#+#....', '...#++++++++#...',
    '..#++#++++#++#..', '..#+#++++++#+#..', '...#+#....#+#...', '...####..####...',
  ],
  scout: [
    '................', '....########....', '...#ssssssss#...', '..#ss######ss#..',
    '.#ss#gg##gg#ss#.', '.#ss#gg##gg#ss#.', '.#ss########ss#.', '.#ssss#ss#ssss#.',
    '.#sssssssssss#.', '..#sss####sss#..', '...#########....', '....#+++++#.....',
    '...#+++++++#....', '..#++#+++#++#...', '..#+#++++++#....', '..##.......##...',
  ],
  gatekeeper: [
    '................', '......####......', '.....#pppp#.....', '....#pp##pp#....',
    '...#p#pppp#p#...', '...#pppppppp#...', '...#p#pppp#p#...', '....#pp##pp#....',
    '.....#pppp#.....', '......####......', '.....#ppPp#.....', '....#p#PP#p#....',
    '...#pp####pp#...', '...#p#####p#....', '....#p####p#....', '....##....##....',
  ],
  brewer: [
    '................', '....########....', '...#eeeeeeee#...', '..#ee######ee#..',
    '.#ee#bb##bb#ee#.', '.#ee########ee#.', '.#ee#wwwwww#ee#.', '.#ee########ee#.',
    '..#ee######ee#..', '...#eeeeeeee#...', '....#+#++#+#....', '...#+++##+++#...',
    '...#+++##+++#...', '...#+#++++#+#...', '...##......##...', '................',
  ],
  patcher: [
    '................', '......####......', '.....#rrrr#.....', '....#rr##rr#....',
    '...#r#o##o#r#...', '...#rr####rr#...', '...#rr#oo#rr#...', '....#r####r#....',
    '.....#####......', '....#+++++#.....', '...#+++++++#....', '..#+#+++++#+#...',
    '..#+#+++++#+#...', '...#+#+++#+#....', '....##...##.....', '................',
  ],
}
