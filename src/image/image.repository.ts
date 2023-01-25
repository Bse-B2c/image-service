import { Image, ImageDocument } from '@image/interfaces/image.interface';
import { Model } from 'mongoose';

export class ImageRepository {
	constructor(private model: Model<ImageDocument>) {}

	create = (image: Image): Promise<ImageDocument> => {
		return new this.model(image).save();
	};

	findOne = (id: string): Promise<ImageDocument | null> => {
		return this.model.findOne({ _id: id }).exec();
	};
}
