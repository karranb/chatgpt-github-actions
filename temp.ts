import { Collection, Field, FilterAttributes, Model } from 'neo4j-node-ogm'
import { z } from 'zod'

import { ResourceNotFoundException } from 'api/core/errors/exceptions'

import { messages } from '../../v1/use-cases/caker/constants'
import { File, FileType } from '../file'

export const CakerType = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string().min(3),
  is_active: z.boolean(),
  profile_image: FileType,
})

type CreateArgs = {
  email: string
  name: string
  profileImage: Express.Multer.File
}

export type CakerType = z.infer<typeof CakerType>

class Caker extends Model {
  constructor(values: unknown) {
    const labels = ['CAKER']
    const attributes = {
      email: Field.String({
        required: true,
      }),
      profile_image: Field.Relationship({
        labels: ['HAS_PROFILE_IMAGE'],
        target: File,
        attributes: {
          is_active: Field.Boolean({
            default: () => true,
          }),
        },
        filter_relationship: {
          is_active: 'true',
        },
      }),
      name: Field.String({ required: true }),
      is_active: Field.Boolean({
       default: () => true,
     }),
   }
   super(values, labels, attributes)
 }
 serialize() {
   const addSuffix = (path: string, suffix: string) => {
     const splittedPath = path.split('.')
     return splittedPath.slice(0, -1).join('.')  suffix  '.'  splittedPath[splittedPath.length - 1]
   }
   return {
     id: this.id,
     email: this.email,
     name: this.name,
     profile_image: this.profile_image
       ? {
           original: this.profile_image.path,
           '200w': addSuffix(this.profile_image.path, '-small'),
           '100w': addSuffix(this.profile_image.path, '-smallest'),
         }
       : undefined,
   }
 }
 static async findByIdOrFail(id: number) {
   const caker = await Caker.findByID(id, { with_related: ['profile_image'] })
   if (!caker) {
     throw new ResourceNotFoundException(messages.CAKER_NOT_FOUND)
   }
   return caker as Caker
 }
 static async findByEmail(email: string): Promise<Caker | null> {
   const caker = (await Caker.findBy(
     [
       {
         key: 'email',
         value: email,
       },
       {
         key: 'is_active',
         value: true,
       },
     ],
     { with_related: ['profile_image'] }
   )) as Collection<Caker>
   return caker.first() as Caker | null
 }
  static findByFilter(
    params: Partial<Pick<CakerType, 'email' | 'id' | 'is_active' | 'name'>>
  ): Promise<Collection<Caker>> {
    const filter = Object.entries(params).reduce((acc: FilterAttributes, [key, value]) => {
      if (value === undefined) {
        return acc
      }
      if (key === 'id') {
        return [...acc, { key: 'id(caker)', value }]
      }

      return [...acc, { key, value, operator: typeof value === 'string' ? 'STARTS WITH' : '=' }]
    }, [])
    return Caker.findBy(filter, { with_related: ['profile_image'] }) as Promise<Collection<Caker>>
  }

  static async softDeleteById(id: number) {
    const caker = await Caker.findByIdOrFail(id)
    caker.is_active = false
    await caker.save()
    return caker
  }

  static async updateProfileImage(caker: Caker, newProfileImage: Express.Multer.File) {
    const file = await File.createFromFile(newProfileImage)
    if (caker.profile_image) {
      await caker.updateRelationship('profile_image', caker.profile_image, { is_active: false })
    }
    await caker.createRelationship('profile_image', file)
    return caker
  }

  static async create({ email, name, profileImage }: CreateArgs) {
    const caker = new Caker({
      email,
      name,
    })
    await caker.save()
    const file = await File.createFromFile(profileImage)
    await caker.createRelationship('profile_image', file)
    return caker
  }
}

export { Caker }