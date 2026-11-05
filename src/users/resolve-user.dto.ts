import { IsString, Length, Matches } from 'class-validator';

export class ResolveUserDto {
  @IsString()
  @Length(1, 128)
  @Matches(/^\S(?:[\s\S]*\S)?$/, {
    message: 'id1 must not have leading or trailing whitespace',
  })
  id1!: string;

  @IsString()
  @Length(1, 128)
  @Matches(/^\S(?:[\s\S]*\S)?$/, {
    message: 'id2 must not have leading or trailing whitespace',
  })
  id2!: string;
}
