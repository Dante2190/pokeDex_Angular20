// Subconjunto del /pokemon-species/{id|name} (para "rareza")
export interface PokemonSpecies {
  is_legendary: boolean;
  is_mythical: boolean;
  capture_rate: number;
}
