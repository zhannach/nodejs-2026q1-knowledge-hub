import { Injectable } from '@nestjs/common';
import { Article } from 'src/article/types';
import { Category } from 'src/category/types';
import { Comment } from 'src/comment/types';
import { User } from 'src/user/types';

@Injectable()
export class DbService {
  users: User[] = [];
  articles: Article[] = [];
  categories: Category[] = [];
  comments: Comment[] = [];
}
