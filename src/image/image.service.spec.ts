import { ImageService } from '@image/image.service';
import { jest } from '@jest/globals';
import { Image } from '@image/interfaces/image.interface';
import { default as data } from '@test/data/images.json';
import { HttpStatusCode, HttpException } from '@bse-b2c/common';
import { Service } from '@image/interfaces/imageService.interface';
import { UpdateImageDto } from '@image/dtos/updateImage.dto';
import path from 'path';
import * as fs from 'fs';
import { SortEnum } from '@src/common/enums/sort.enum';
import { Types } from 'mongoose';

jest.mock('fs');

const mockRepository = {
	create: jest.fn(
		(image: Image): Promise<any> =>
			Promise.resolve({
				...image,
				_id: '63cfde53c12118dcd67b654d',
				url: `http://localhost:4700/img/${image.key}`,
				createdAt: '2023-01-24T13:25:19.609Z',
			})
	),
	findOne: jest.fn((id: string): Promise<any> => {
		return Promise.resolve(data.find(image => image._id === id));
	}),
	update: jest.fn(
		(id: string, { name, description }: UpdateImageDto): Promise<any> => {
			const image = data.find(e => e._id === id);

			if (image) Object.assign(image, { name, description });

			return Promise.resolve(image);
		}
	),
	find: jest.fn((): Promise<any> => Promise.resolve([])),
	delete: jest.fn(
		(id: string): Promise<any> => Promise.resolve(data.find(e => e._id === id))
	),
};

describe('ImageService', () => {
	let service: Service;

	beforeEach(() => {
		service = new ImageService(mockRepository);
		jest.clearAllMocks();
	});

	describe('create', () => {
		const input = {
			name: 'test2.png',
			description: 'test2 de descrição',
			size: 11189,
			key: 'e2745bc44f43d4c3f0ac157cf808f900-test2.png',
			url: '',
		};

		it('should return the created image', async () => {
			const response = await service.create(input);

			expect(response).toBeDefined();
			expect(response).toMatchObject({
				...input,
				_id: '63cfde53c12118dcd67b654d',
				url: `http://localhost:4700/img/e2745bc44f43d4c3f0ac157cf808f900-test2.png`,
				createdAt: '2023-01-24T13:25:19.609Z',
			});
			expect(mockRepository.create).toBeCalledTimes(1);
			expect(mockRepository.create).toBeCalledWith(input);
		});
	});

	describe('findOne', () => {
		let id = '63d089bdcd33c453c10568f4';

		it('should return image if image exists', async () => {
			const image = data.find(image => image._id === id) ?? {};
			const response = await service.findOne(id);

			expect(response).toBeDefined();
			expect(response).toMatchObject(image);
			expect(mockRepository.findOne).toBeCalledTimes(1);
			expect(mockRepository.findOne).toHaveBeenCalledWith(id);
		});

		it('should return a "not found" error message if the image does not exist', async () => {
			id = '63d089bdcd33c453c10564j1';
			await expect(service.findOne(id)).rejects.toThrow(
				new HttpException({
					statusCode: HttpStatusCode.NOT_FOUND,
					message: `Image ${id} not found`,
				})
			);
		});
	});

	describe('update', () => {
		let id = '63d089bdcd33c453c10568f4';
		let input = { name: 'updated Image', description: 'updated Image' };

		it('should return the updated Image', async () => {
			const image = data.find(e => e._id === id);
			const response = await service.update(id, input);

			expect(response).toBeDefined();
			expect(response).toMatchObject({ ...image, ...input });
			expect(mockRepository.findOne).toBeCalledTimes(1);
			expect(mockRepository.update).toBeCalledTimes(1);
			expect(mockRepository.update).toHaveBeenCalledWith(id, input);
		});

		it('should return a "not found" error message if the image does not exist', async () => {
			id = '63d089bdcd33c453c10564j1';

			await expect(service.update(id, input)).rejects.toThrow(
				new HttpException({
					statusCode: HttpStatusCode.NOT_FOUND,
					message: `Image ${id} not found`,
				})
			);
		});
	});

	describe('delete', () => {
		let id = '63d089bdcd33c453c10568f4';

		it('should delete image file if image is deleted in database', async () => {
			jest
				.spyOn(mockRepository, 'delete')
				.mockResolvedValue({ acknowledged: false, deletedCount: 1 });

			const image = data.find(e => e._id === id);
			const response = await service.delete(id);

			expect(response).toBeDefined();
			expect(response).toMatchObject(image ?? {});
			expect(mockRepository.delete).toBeCalledTimes(1);
			expect(mockRepository.delete).toHaveBeenCalledWith(id);
			expect(fs.unlinkSync).toBeCalledTimes(1);
			expect(fs.unlinkSync).toHaveBeenCalledWith(
				path.join(__dirname, '..', '..', 'tmp', 'uploads', image?.key ?? '')
			);
		});

		it('should not delete image file if image is not deleted in database', async () => {
			const image = data.find(e => e._id === id);
			jest
				.spyOn(mockRepository, 'delete')
				.mockResolvedValue({ acknowledged: false, deletedCount: 0 });

			const response = await service.delete(id);

			expect(response).toBeDefined();
			expect(response).toMatchObject(image ?? {});
			expect(mockRepository.delete).toBeCalledTimes(1);
			expect(mockRepository.delete).toHaveBeenCalledWith(id);
			expect(fs.unlinkSync).toBeCalledTimes(0);
			expect(fs.unlinkSync).not.toHaveBeenCalled();
		});

		it('should return a "not found" error message if the image does not exist', async () => {
			id = '63d089bdcd33c453c10564j1';

			await expect(service.delete(id)).rejects.toThrow(
				new HttpException({
					statusCode: HttpStatusCode.NOT_FOUND,
					message: `Image ${id} not found`,
				})
			);
		});
	});

	describe('find', () => {
		const defaultSearch = {
			search: 'text',
			orderBy: 'name',
			sortOrder: SortEnum.ASC,
			page: 0,
			limit: 10,
		};

		it('should call repository "find" with text search info', async () => {
			const response = await service.find(defaultSearch);

			expect(response).toBeDefined();
			expect(mockRepository.find).toBeCalledTimes(1);
			expect(mockRepository.find).toHaveBeenCalledWith({
				match: {
					$text: { $search: defaultSearch.search, $caseSensitive: true },
				},
				sort: { [defaultSearch.orderBy]: defaultSearch.sortOrder },
				skip: defaultSearch.page * defaultSearch.limit,
				limit: defaultSearch.limit,
			});
		});

		it('should perform the search based on the ids', async () => {
			const ids = ['63d089bdcd33c453c10568f4', '63d089bdcd33c453c10568f8'];
			const response = await service.find({
				...defaultSearch,
				search: undefined,
				ids,
			});

			expect(response).toBeDefined();
			expect(mockRepository.find).toBeCalledTimes(1);
			expect(mockRepository.find).toHaveBeenCalledWith({
				match: {
					_id: { $in: ids.map(id => new Types.ObjectId(id)) },
				},
				sort: { [defaultSearch.orderBy]: defaultSearch.sortOrder },
				skip: defaultSearch.page * defaultSearch.limit,
				limit: defaultSearch.limit,
			});
		});

		it('should perform the search based on the keys', async () => {
			const keys = [
				'e2745bc44f43d4c3f0ac157cf808f900-teste1.png',
				'e2745bc44f43d4c3f0ac157cf808f900-teste2.png',
			];
			const response = await service.find({
				...defaultSearch,
				search: undefined,
				keys,
			});

			expect(response).toBeDefined();
			expect(mockRepository.find).toBeCalledTimes(1);
			expect(mockRepository.find).toHaveBeenCalledWith({
				match: {
					key: { $in: keys },
				},
				sort: { [defaultSearch.orderBy]: defaultSearch.sortOrder },
				skip: defaultSearch.page * defaultSearch.limit,
				limit: defaultSearch.limit,
			});
		});

		it('should perform the search based on the start Date', async () => {
			const startDate = '2023-02-01T01:03:06.473Z';
			const response = await service.find({
				...defaultSearch,
				search: undefined,
				startDate,
			});

			expect(response).toBeDefined();
			expect(mockRepository.find).toBeCalledTimes(1);
			expect(mockRepository.find).toHaveBeenCalledWith({
				match: {
					createdAt: { $gte: new Date(startDate) },
				},
				sort: { [defaultSearch.orderBy]: defaultSearch.sortOrder },
				skip: defaultSearch.page * defaultSearch.limit,
				limit: defaultSearch.limit,
			});
		});

		it('should perform the search based on the end Date', async () => {
			const endDate = '2023-02-10T01:03:06.473Z';
			const response = await service.find({
				...defaultSearch,
				search: undefined,
				endDate,
			});

			expect(response).toBeDefined();
			expect(mockRepository.find).toBeCalledTimes(1);
			expect(mockRepository.find).toHaveBeenCalledWith({
				match: {
					createdAt: { $lte: new Date(endDate) },
				},
				sort: { [defaultSearch.orderBy]: defaultSearch.sortOrder },
				skip: defaultSearch.page * defaultSearch.limit,
				limit: defaultSearch.limit,
			});
		});
	});
});
