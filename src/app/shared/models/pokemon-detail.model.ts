export interface PokemonDetail {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number;

  stats: Array<{
    base_stat: number;
    effort: number;
    stat: { name: 'hp' | 'attack' | 'defense' | 'special-attack' | 'special-defense' | 'speed' | string };
  }>;
  
  abilities: Array<{
    ability: { name: string; url?: string };
    is_hidden: boolean;
    slot: number;
  }>;

  /** 👇 añadimos solo lo necesario para pedir luego el detalle del movimiento */
  moves: Array<{
    move: { name: string; url: string };
  }>;

  types: Array<{ slot: number; type: { name: string } }>;
  sprites: {
    front_default?: string;
    other?: {
      ['official-artwork']?: { front_default?: string };
    };
  };
  cries?: { latest?: string; legacy?: string };
}
