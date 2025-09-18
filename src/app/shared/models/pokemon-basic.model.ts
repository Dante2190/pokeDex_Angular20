// Lo que usamos para las cards de la lista
export interface PokemonBasic {
  id: number;
  name: string;
  imageUrl: string;

  // Enriquecimiento opcional (lo llenas con el detalle)
  types?: string[];
  height?: number;
  weight?: number;
  baseExp?: number;
}
