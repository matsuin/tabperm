#!/bin/perl

sub ab($$) {
  my $n = shift;
  my $f = shift;

  my $x = 8 - $f * 6;
  my $y = 1 + $n * 3;
  my $l = 4 + $f * 8;

  print("M${x} ${y}a1 1 0 0 0 0 2h${l}a1 1 0 0 0 0-2h-${l}z");
}


print('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">');
print('<path fill="context-fill" fill-opacity="context-fill-opacity" d="');

my $x = $ARGV[0];
for (my $i = 0; $i < 5; $i++) {
  my $m = 1 << $i;
  my $b = ($x & $m) ? 1 : 0;
  ab($i, $b);
}
print('"/></svg>');
