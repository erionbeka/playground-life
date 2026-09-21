interface ShapeBuildConfig {
  scene?: string;
  template?: string[];
  pieceOptions?: string[];
}

const buildPieces: Record<string, string[]> = {
  house: ["cube", "plank", "prism", "column"],
  garden: ["cube", "cube", "sphere", "arch"],
  spaceship: ["plank", "prism", "column", "sphere"],
  castle: ["cube", "column", "cube", "prism"],
  farm: ["cube", "prism", "plank", "sphere"],
  city: ["cube", "column", "cube", "plank"],
  "ocean scene": ["plank", "sphere", "wedge", "arch"],
  forest: ["column", "sphere", "column", "prism"],
  "vehicle puzzle": ["sphere", "plank", "cube", "wedge"],
  hospital: ["cube", "cross", "plank", "column"],
  "fire station": ["cube", "column", "plank", "prism"],
  classroom: ["cube", "plank", "slab", "letter"],
  kitchen: ["cube", "plank", "sphere", "cross"],
  default: ["cube", "prism", "plank", "sphere"],
};

export function getBuildTemplate(config: ShapeBuildConfig) {
  return config.template || buildPieces[String(config.scene || "default")] || buildPieces.default;
}

export function getBuildPieceOptions(config: ShapeBuildConfig, template: string[]) {
  const configured = config.pieceOptions;
  const defaults = Array.from(new Set([...template, "cube", "prism", "sphere", "plank", "column", "arch", "wedge", "diamond"]));
  return configured || defaults.slice(0, Math.max(defaults.length, template.length + 2));
}
