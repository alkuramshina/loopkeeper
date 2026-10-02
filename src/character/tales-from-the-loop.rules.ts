// Server validation rules; visual sheet definitions belong to the frontend.
export type CharacterFieldRule = {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  options?: string[];
};
export const talesFromTheLoopRules: { fields: CharacterFieldRule[] } = {
  fields: [
    {
      key: 'age',
      type: 'number',
      required: true,
      min: 10,
      max: 19,
    },
    {
      key: 'type',
      type: 'select',
      required: true,
      options: [
        'BOOKWORM',
        'COMPUTER_GEEK',
        'JOCK',
        'POPULAR_KID',
        'ROCKER',
        'TROUBLEMAKER',
        'WEIRDO',
      ],
    },
    {
      key: 'body',
      type: 'number',
      min: 1,
      max: 5,
    },
    {
      key: 'tech',
      type: 'number',
      min: 1,
      max: 5,
    },
    {
      key: 'heart',
      type: 'number',
      min: 1,
      max: 5,
    },
    {
      key: 'mind',
      type: 'number',
      min: 1,
      max: 5,
    },
    {
      key: 'force',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'move',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'sneak',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'tinker',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'program',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'calculate',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'contact',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'charm',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'lead',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'investigate',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'comprehend',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'empathize',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'drive',
      type: 'string',
      maxLength: 500,
    },
    {
      key: 'pride',
      type: 'string',
      maxLength: 500,
    },
    {
      key: 'problem',
      type: 'string',
      maxLength: 500,
    },
    {
      key: 'anchor',
      type: 'string',
      maxLength: 500,
    },
    {
      key: 'iconicItem',
      type: 'string',
      maxLength: 100,
    },
    {
      key: 'relationships',
      type: 'string',
      maxLength: 2000,
    },
    {
      key: 'favoriteSong',
      type: 'string',
      maxLength: 200,
    },
    {
      key: 'inventory',
      type: 'string',
      maxLength: 2000,
    },
    {
      key: 'luckPoints',
      type: 'number',
      min: 0,
      max: 6,
    },
    {
      key: 'upset',
      type: 'boolean',
    },
    {
      key: 'scared',
      type: 'boolean',
    },
    {
      key: 'exhausted',
      type: 'boolean',
    },
    {
      key: 'injured',
      type: 'boolean',
    },
    {
      key: 'broken',
      type: 'boolean',
    },
  ],
};
