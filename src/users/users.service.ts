import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<User> {
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await this.hashPassword(userData.password);

    const user = this.userRepository.create({
      ...userData,
      password: hashedPassword,
    });

    return this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await this.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    return user;
  }
}
