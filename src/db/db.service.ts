import { Injectable } from '@nestjs/common';
import { User, Article, Category, Comment } from '../types';

@Injectable()
export class DbService {
  users: User[] = [];
  articles: Article[] = [];
  categories: Category[] = [];
  comments: Comment[] = [];
}
