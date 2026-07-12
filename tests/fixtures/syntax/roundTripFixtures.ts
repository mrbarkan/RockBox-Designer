export const roundTripFixtures = [
  {
    name: 'plain text',
    source: 'Now playing\nA second line'
  },
  {
    name: 'comments and blank lines',
    source: '# Theme comment\n\n  # Indented comment\nText'
  },
  {
    name: 'LF line endings',
    source: '%it\n%ia\n%id\n'
  },
  {
    name: 'CRLF line endings',
    source: '%it\r\n%ia\r\n%id\r\n'
  },
  {
    name: 'UTF-8 metadata text',
    source: 'Björk — Jóga\n日本語のメタデータ\nOlá, mundo'
  },
  {
    name: 'no-argument tags',
    source: '%it %ia %mp %wd'
  },
  {
    name: 'parenthesis arguments',
    source: '%V( 0, 0, 320, 240, - )'
  },
  {
    name: 'pipe arguments',
    source: '%x|theme_img/cover.bmp|'
  },
  {
    name: 'escaped legal characters',
    source: '100%% %<left%> pipe%| semicolon%; hash%# comma%,'
  },
  {
    name: 'unknown tags',
    source: '%zzFuture(alpha, beta)\n%Qq|raw-value|'
  },
  {
    name: 'nested conditionals',
    source: '%?mh<hold|%?mp<playing|paused>>'
  },
  {
    name: 'parameterized conditional test',
    source: '%?if(%pv, =, -90)<muted|audible>'
  },
  {
    name: 'empty conditional branches',
    source: '%?mp<|paused|>'
  },
  {
    name: 'multiple tags on one line',
    source: '%al%it — %ia%ar%pc'
  },
  {
    name: 'image preload and display',
    source: '%xl|A|theme_img/strip.bmp|0|0|10|\n%xd(A,2)\n%x|theme_img/icon.bmp|'
  },
  {
    name: 'viewports',
    source: '%V(0,0,320,240,-)\n%Vl(main,0,20,320,220,-)\n%Vd(main)'
  },
  {
    name: 'progress and volume bars',
    source: '%pb(0,220,320,8,-)\n%pv(0,230,320,8,-)'
  },
  {
    name: 'touch regions',
    source: '%T(0,0,50,50,play)'
  },
  {
    name: 'album art',
    source: '%Cl(20,20,100,100,c,c)\n%Cd'
  },
  {
    name: 'malformed but preservable input',
    source: '%?mp<playing|paused'
  }
] as const;
