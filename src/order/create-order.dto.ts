import { IsNotEmpty } from "class-validator";

export class CreateOrderDto {
    @IsNotEmpty()
    userId: number;

    @IsNotEmpty()
    type: string;

    @IsNotEmpty()
    quantity: number;

    @IsNotEmpty()
    price: number;
}
