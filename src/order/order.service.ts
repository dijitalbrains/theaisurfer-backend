import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { CreateOrderDto } from './create-order.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async create(order: CreateOrderDto) {
    return this.orderRepo.save({
      userId: order.userId,
      type: order.type,
      quantity: order.quantity,
      price: order.price,
    });
  }
}
