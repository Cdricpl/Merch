/**
 * Illustration de scène pour la carte Caisse.
 *
 * Dessinée en SVG plutôt qu'importée en image : aucun fichier à charger, elle
 * suit la couleur du thème, et elle reste nette à toutes les densités d'écran.
 *
 * Volontairement très sombre : c'est une texture d'arrière-plan, pas une
 * illustration. Le montant de la caisse doit rester ce qu'on voit en premier.
 */
export function StageArt({ className = "" }: { className?: string }) {
  // Foule : des têtes de tailles variées, réparties irrégulièrement pour éviter
  // l'effet peigne d'un espacement constant.
  const heads: Array<[number, number, number]> = [
    [4, 80, 6.5], [17, 84, 5], [29, 78, 7.5], [42, 85, 5.5],
    [54, 81, 6.5], [65, 86, 4.5], [76, 79, 7.5], [88, 84, 5.5], [98, 81, 6.5],
  ];
  const arms: Array<[number, number]> = [[11, 76], [36, 72], [60, 74], [82, 70]];

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sa-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d1d22" />
          <stop offset="100%" stopColor="#0a0a0c" />
        </linearGradient>
        <linearGradient id="sa-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* Fondu vers la gauche : le texte de la carte reste lisible par-dessus. */}
        <linearGradient id="sa-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#141416" />
          <stop offset="70%" stopColor="#141416" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="100" height="100" fill="url(#sa-sky)" />

      <g fill="url(#sa-beam)">
        <polygon points="28,0 36,0 12,74 0,74" />
        <polygon points="46,0 52,0 42,74 32,74" />
        <polygon points="62,0 68,0 80,74 68,74" />
        <polygon points="78,0 84,0 98,74 86,74" />
      </g>

      {/* Foule au premier plan */}
      <g fill="#050506">
        {arms.map(([x, y], i) => (
          <rect key={`a${i}`} x={x} y={y} width="1.4" height="18" rx="0.7" />
        ))}
        {heads.map(([x, y, r], i) => (
          <g key={`h${i}`}>
            <circle cx={x} cy={y} r={r} />
            <rect x={x - r * 1.3} y={y + r * 0.5} width={r * 2.6} height="28" rx={r * 0.85} />
          </g>
        ))}
      </g>

      <rect width="100" height="100" fill="url(#sa-fade)" />
    </svg>
  );
}
