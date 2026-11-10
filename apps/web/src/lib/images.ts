// Central image mapping. The database image columns (poster_url, banner_url,
// image_url, cover_image_url) win when they are set; otherwise the local file in
// public/images is used, matched by the record's natural key (name, and universe
// for characters, whose names are only unique within a universe).
//
// Files are downloaded by scripts/fetch-images.mjs; sources and licences are in
// public/images/ATTRIBUTION.md. A missing entry shows the styled placeholder.

const UNIVERSES: Record<string, string> = {
  "Game of Thrones": "/images/universes/game-of-thrones.jpg",
  "Fullmetal Alchemist": "/images/universes/fullmetal-alchemist.jpg",
  Naruto: "/images/universes/naruto.jpg",
  "The Matrix": "/images/universes/the-matrix.jpg",
};

const TITLES: Record<string, string> = {
  "Game of Thrones": "/images/titles/game-of-thrones.jpg",
  "House of the Dragon": "/images/titles/house-of-the-dragon.png",
  "Fullmetal Alchemist": "/images/titles/fullmetal-alchemist.png",
  "Fullmetal Alchemist: Brotherhood": "/images/titles/fullmetal-alchemist-brotherhood.png",
  Naruto: "/images/titles/naruto.jpg",
  "Naruto Shippuden": "/images/titles/naruto-shippuden.jpg",
  "The Matrix": "/images/titles/the-matrix.png",
  "The Matrix Reloaded": "/images/titles/the-matrix-reloaded.jpg",
  "The Matrix Revolutions": "/images/titles/the-matrix-revolutions.png",
  Inception: "/images/titles/inception.jpg",
};

// Key: "<universe>/<character>". Walder Frey, Dom Cobb and Mal have no source image.
const CHARACTERS: Record<string, string> = {
  "Game of Thrones/Eddard Stark": "/images/characters/eddard-stark.jpg",
  "Game of Thrones/Catelyn Stark": "/images/characters/catelyn-stark.png",
  "Game of Thrones/Robb Stark": "/images/characters/robb-stark.jpg",
  "Game of Thrones/Sansa Stark": "/images/characters/sansa-stark.jpg",
  "Game of Thrones/Arya Stark": "/images/characters/arya-stark.jpg",
  "Game of Thrones/Jon Snow": "/images/characters/jon-snow.png",
  "Game of Thrones/Daenerys Targaryen": "/images/characters/daenerys-targaryen.jpg",
  "Game of Thrones/Tyrion Lannister": "/images/characters/tyrion-lannister.jpg",
  "Game of Thrones/Joffrey Baratheon": "/images/characters/joffrey-baratheon.jpg",
  "Game of Thrones/Ramsay Bolton": "/images/characters/ramsay-bolton.jpg",
  "Game of Thrones/Rhaenyra Targaryen": "/images/characters/rhaenyra-targaryen.webp",
  "Game of Thrones/Daemon Targaryen": "/images/characters/daemon-targaryen.png",
  "Fullmetal Alchemist/Edward Elric": "/images/characters/edward-elric.jpg",
  "Fullmetal Alchemist/Alphonse Elric": "/images/characters/alphonse-elric.jpg",
  "Fullmetal Alchemist/Roy Mustang": "/images/characters/roy-mustang.jpg",
  "Naruto/Naruto Uzumaki": "/images/characters/naruto-uzumaki.png",
  "Naruto/Sasuke Uchiha": "/images/characters/sasuke-uchiha.jpg",
  "Naruto/Kakashi Hatake": "/images/characters/kakashi-hatake.jpg",
  "The Matrix/Neo": "/images/characters/neo.jpg",
  "The Matrix/Trinity": "/images/characters/trinity.jpg",
  "The Matrix/Morpheus": "/images/characters/morpheus.jpg",
  "The Matrix/Agent Smith": "/images/characters/agent-smith.jpg",
};

type Url = string | null | undefined;

export const universeImage = (name: string, dbUrl?: Url) => dbUrl || UNIVERSES[name] || null;
export const titleImage = (name: string, dbUrl?: Url) => dbUrl || TITLES[name] || null;
/** `universe` undefined = not known by the caller (e.g. a bookmark row): match on the name alone. */
export const characterImage = (name: string, universe: string | null | undefined, dbUrl?: Url) =>
  dbUrl ||
  (universe === undefined
    ? Object.entries(CHARACTERS).find(([key]) => key.endsWith(`/${name}`))?.[1]
    : CHARACTERS[`${universe ?? ""}/${name}`]) ||
  null;

/** A stable accent colour per universe, used for small markers and badges. */
const UNIVERSE_TONES: Record<string, string> = {
  "Game of Thrones": "text-coral",
  "Fullmetal Alchemist": "text-amber",
  Naruto: "text-aqua",
  "The Matrix": "text-accent",
};
export const universeTone = (name: string | null | undefined) => (name && UNIVERSE_TONES[name]) || "text-muted";
