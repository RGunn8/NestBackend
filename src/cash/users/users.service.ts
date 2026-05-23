import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepo.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const id = dto.id?.trim();
    const email = dto.email?.trim().toLowerCase();

    if (!id) {
      throw new BadRequestException('User id is required');
    }
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const existing = await this.usersRepo.findOne({
      where: [{ id }, { email }],
    });
    if (existing) {
      throw new ConflictException(
        existing.id === id
          ? `User with id "${id}" already exists`
          : `User with email "${email}" already exists`,
      );
    }

    const user = this.usersRepo.create({ id, email });
    return this.usersRepo.save(user);
  }
}
