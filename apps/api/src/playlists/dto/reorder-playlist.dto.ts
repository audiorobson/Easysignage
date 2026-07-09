import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderPlaylistDto {
  /** IDs dos `playlist_items` na ordem desejada (completo). */
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  orderedItemIds!: string[];
}
