import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';



export class AddGroupMembersDto {

  @IsArray()

  @ArrayNotEmpty()

  @IsUUID('4', { each: true })

  deviceIds!: string[];

}

