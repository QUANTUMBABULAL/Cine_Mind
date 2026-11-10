// Shapes of the API responses used by the UI.

export interface User {
  user_id: number;
  username: string;
  email: string;
  account_status: string;
  roles: string[];
  permissions: string[];
}

export interface Universe {
  universe_id: number;
  name: string;
  description: string | null;
  origin_type: string;
  cover_image_url: string | null;
  title_count?: number;
  character_count?: number;
}

export interface TitleSummary {
  title_id: number;
  title_name: string;
  media_type: string;
  status: string;
  release_date: string | null;
  synopsis: string | null;
  poster_url: string | null;
  universe_id: number | null;
  universe_name: string | null;
  genres: string[];
  average_rating: number | null;
  review_count: number;
  character_count: number;
}

export interface Review {
  review_id: number;
  user_id: number;
  username: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface CastMember {
  character_id: number;
  name: string;
  image_url: string | null;
  species: string | null;
  character_role: string;
  appearance_notes: string | null;
}

export interface TitleDetail extends TitleSummary {
  banner_url: string | null;
  characters: CastMember[];
  reviews: Review[];
  event_count: number;
}

export interface CharacterSummary {
  character_id: number;
  character_name: string;
  universe_id: number | null;
  universe_name: string | null;
  species: string | null;
  gender: string | null;
  image_url: string | null;
  appearance_count: number;
  event_count: number;
}

export interface Relationship {
  relationship_id: number;
  direction: "outgoing" | "incoming";
  relationship_type: string;
  description: string | null;
  source_id: number;
  source_name: string;
  target_id: number;
  target_name: string;
}

export interface ArcStep {
  sequence_number: number;
  event_id: number;
  event_name: string;
  development_note: string | null;
}

export interface Arc {
  arc_id: number;
  arc_name: string;
  description: string | null;
  starting_state: string | null;
  ending_state: string | null;
  arc_status: string;
  character_id: number;
  character_name: string;
  title_id: number;
  title_name: string;
  steps: ArcStep[];
}

export interface CharacterDetail extends CharacterSummary {
  biography: string | null;
  first_appearance_date: string | null;
  outgoing_relationships: number;
  incoming_relationships: number;
  appearances: {
    title_id: number;
    title_name: string;
    media_type: string;
    release_date: string | null;
    character_role: string;
    appearance_notes: string | null;
  }[];
  relationships: Relationship[];
  arcs: Arc[];
}

export interface TimelineEntry {
  title_id: number;
  title_name: string;
  event_id: number;
  event_name: string;
  chronology_order: number;
  release_order: number;
  spoiler_level: string;
  participation_type: string;
  involvement_description: string | null;
  outcome: string | null;
}

export interface StoryEvent {
  event_id: number;
  event_name: string;
  description: string | null;
  chronology_order: number;
  release_order: number;
  spoiler_level: string;
  participants: {
    character_id: number;
    name: string;
    participation_type: string;
    outcome: string | null;
    involvement_description: string | null;
  }[];
}
