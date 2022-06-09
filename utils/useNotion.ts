import { Client } from '@notionhq/client'
import {
  NotionPage,
  BlockObjectResponse,
  MarkdownAndImages,
  PageData,
  RichTextItemResponse,
  GetPageResponse,
} from '@customtypes/notion'

export default class Notion {
  client: Client

  constructor() {
    this.client = new Client({ auth: process.env.NOTION_TOKEN })
  }

  private static isHref = (text: string, href: string | null) => {
    if (href) return `[${text}](${href})`
    else return text
  }

  private static formatText = (annotations: RichTextItemResponse['annotations'], text: string): string => {
    if (annotations.bold) text = '**' + text + '**'
    if (annotations.italic) text = '*' + text + '*'
    if (annotations.strikethrough) text = '~~' + text + '~~'
    if (annotations.code) text = '`' + text + '`'
    return text
  }

  private static addNewLine = (text: string) => '\n' + text + '\n'

  private static textToMarkdown = (text: Array<RichTextItemResponse>) => {
    let markdown = ''
    for (const t of text) {
      let chunk = ''
      chunk = Notion.isHref(t.plain_text, t.href)
      chunk = Notion.formatText(t.annotations, chunk)
      markdown += chunk
    }
    return markdown
  }

  private static convertBlocksToMarkdown(blocks: BlockObjectResponse[]): MarkdownAndImages {
    let data = ''
    const images = []

    // Other cases: audio, bookmark, breadcrumb, child_database, child_page, column, column_list
    // divider, link_preview, link_to_page, synced_block, table, table_of_contents, table_row
    // template, toggle, unsupported

    for (const block of blocks) {
      switch (block.type) {
        case 'code':
          break
        case 'embed':
          break
        case 'equation':
          break
        case 'file':
          break
        case 'numbered_list_item':
          break
        case 'pdf':
          break
        case 'quote':
          break
        case 'video':
          break
        case 'paragraph':
          const paragraph = Notion.textToMarkdown(block.paragraph.rich_text)
          data += Notion.addNewLine(paragraph)
          break
        case 'heading_1':
          const headingOne = Notion.textToMarkdown(block.heading_1.rich_text)
          data += Notion.addNewLine(`# ${headingOne}`)
          break
        case 'heading_2':
          const headingTwo = Notion.textToMarkdown(block.heading_2.rich_text)
          data += Notion.addNewLine(`## ${headingTwo}`)
          break
        case 'heading_3':
          const headingThree = Notion.textToMarkdown(block.heading_3.rich_text)
          data += Notion.addNewLine(`### ${headingThree}`)
          break
        case 'image':
          const caption = block.image.caption[0].plain_text ? block.image.caption[0].plain_text : ''
          if ('external' in block.image) {
            images.push([block.image.external.url, caption])
          } else {
            images.push([block.image.file.url, caption])
          }
          break
        case 'callout':
          const icon = block.callout.icon?.type === 'emoji' ? block.callout.icon.emoji : '💫'
          const callout = Notion.textToMarkdown(block.callout.rich_text)
          data += Notion.addNewLine(`> ${icon} ${callout}`)
          break
        case 'bulleted_list_item':
          const bullet = Notion.textToMarkdown(block.bulleted_list_item.rich_text)
          data += Notion.addNewLine(`* ${bullet}`)
          break
        case 'to_do':
          const todo = Notion.textToMarkdown(block.to_do.rich_text)
          if (block.to_do.checked) data += Notion.addNewLine(`[x] ${todo}`)
          else data += Notion.addNewLine(`[ ] ${todo}`)
          break
        default:
          throw Error('Invalid block type.')
      }
    }

    return { markdown: data, images }
  }

  private static convertPageToPostPreview(page: GetPageResponse): NotionPage {
    let cover = ''

    if (page.cover) {
      switch (page.cover.type) {
        case 'file':
          cover = page.cover.file.url
          break
        case 'external':
          cover = page.cover.external.url
          break
        default:
          // TODO: Add a default cover
          cover = ''
      }
    }

    if ('rich_text' in page.properties.Slug && page.properties.Slug.rich_text.length === 0) throw Error('Missing slug.')

    return {
      id: page.id,
      cover: cover,
      title: 'title' in page.properties.Title ? page.properties.Title.title[0].plain_text : 'Untitled',
      tags: 'multi_select' in page.properties.Tags ? page.properties.Tags.multi_select : [],
      description:
        'rich_text' in page.properties.Description ? page.properties.Description.rich_text[0].plain_text : '',
      date: 'last_edited_time' in page.properties.Updated ? page.properties.Updated.last_edited_time : 'N/A',
      slug: 'rich_text' in page.properties.Slug ? page.properties.Slug.rich_text[0].plain_text : '',
    }
  }

  /**
   * Retrieves all pages in Notion Database
   * @param table blog or work
   * @returns NotionPage[]
   */
  async getAllPages(table: string): Promise<NotionPage[] | void> {
    let database_id

    switch (table) {
      case 'blog':
        database_id = process.env.NOTION_BLOG_DATABASE_ID
        break
      case 'work':
        database_id = process.env.NOTION_PROJECT_DATABASE_ID
        break
      default:
        database_id = null
    }

    if (database_id) {
      try {
        const res = await this.client.databases.query({
          database_id,
          filter: {
            property: 'Published',
            checkbox: {
              equals: true,
            },
          },
          sorts: [
            {
              property: 'Updated',
              direction: 'descending',
            },
          ],
        })
        return res.results.map(proj => Notion.convertPageToPostPreview(proj as GetPageResponse))
      } catch (err) {
        console.error('>> Issue while getting pages.', err)
      }
    } else console.error(`>> Missing ${table} database ID.`)
  }

  async getPage(slug: string, table: string): Promise<PageData | void> {
    let database_id

    switch (table) {
      case 'blog':
        database_id = process.env.NOTION_BLOG_DATABASE_ID
        break
      case 'work':
        database_id = process.env.NOTION_PROJECT_DATABASE_ID
        break
      default:
        database_id = null
    }

    if (database_id) {
      try {
        const res = await this.client.databases.query({
          database_id,
          filter: {
            property: 'Slug',
            rich_text: {
              equals: slug,
            },
          },
        })

        if (!res.results[0]) throw `Entry with slug ${slug} not found.`

        const results = res.results[0]
        const page = await this.client.blocks.children.list({ block_id: results.id })
        const { markdown, images } = Notion.convertBlocksToMarkdown(page.results as BlockObjectResponse[])
        const pageInfo = Notion.convertPageToPostPreview(results as GetPageResponse)
        return { markdown, images, pageInfo }
      } catch (err) {
        console.error('>> Issue while getting page.', err)
      }
    }
  }
}
