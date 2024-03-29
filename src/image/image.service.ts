import { Image, ImageDocument } from '@image/interfaces/image.interface';
import { HttpStatusCode, HttpException } from '@bse-b2c/common';
import { Repository } from '@image/interfaces/imageRepository.interface';
import { Search } from '@image/interfaces/search.interface';
import { FilterQuery, Types } from 'mongoose';
import { SortEnum } from '@src/common/enums/sort.enum';
import { UpdateImageDto } from '@image/dtos/updateImage.dto';
import { unlinkSync } from 'fs';
import path from 'path';

export class ImageService {
	constructor(private repository: Repository) {}

	/**
	 * Create an image
	 * @param image Image file information
	 * @return The created image document
	 */
	create = (image: Image): Promise<ImageDocument> => {
		return this.repository.create(image);
	};

	/**
	 * Find One Image
	 * @param id - The unique id of the image
	 * @return The image found
	 */
	findOne = async (id: string): Promise<ImageDocument> => {
		const image = await this.repository.findOne(id);

		if (!image) {
			throw new HttpException({
				statusCode: HttpStatusCode.NOT_FOUND,
				message: `Image ${id} not found`,
			});
		}

		return image;
	};

	/**
	 * Delete an image
	 * @param id - The unique id of the image
	 * @return The deleted image
	 */
	delete = async (id: string): Promise<ImageDocument> => {
		const image = await this.findOne(id);

		const { deletedCount } = await this.repository.delete(id);

		if (deletedCount > 0) {
			unlinkSync(path.join(__dirname, '..', '..', 'tmp', 'uploads', image.key));
		}

		return image;
	};

	/**
	 * Update an image
	 * @param id - The unique id of the image
	 * @param input - Updated image data
	 * @param input.name - The name of the image
	 * @param input.description - The description of the image
	 * @return The updated image
	 */
	update = async (
		id: string,
		{ name, description }: UpdateImageDto
	): Promise<ImageDocument> => {
		const image = await this.findOne(id);

		await this.repository.update(id, { name, description });

		Object.assign(image, { name, description });

		return image;
	};

	/**
	 * Find images
	 * @param searchOption - Image search options
	 * @return The images found
	 */
	find = ({
		ids,
		keys,
		search,
		startDate,
		endDate,
		orderBy = 'name',
		sortOrder = SortEnum.ASC,
		page = 0,
		limit = 10,
	}: Search): Promise<Array<ImageDocument>> => {
		let match: FilterQuery<any> = {};
		let searchDate: FilterQuery<any> = {};

		if (search)
			match = { ...match, $text: { $search: search, $caseSensitive: true } };

		if (ids)
			match = { ...match, _id: { $in: ids.map(id => new Types.ObjectId(id)) } };

		if (keys) match = { ...match, key: { $in: keys } };

		if (startDate) searchDate = { ...searchDate, $gte: new Date(startDate) };

		if (endDate) searchDate = { ...searchDate, $lte: new Date(endDate) };

		if (startDate || endDate) match = { ...match, createdAt: searchDate };

		return this.repository.find({
			match: match,
			sort: { [orderBy]: sortOrder },
			skip: page * limit,
			limit,
		});
	};
}
