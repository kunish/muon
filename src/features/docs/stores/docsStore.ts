import type { DocEntry, DocSectionId } from '../types/doc'
import { getClient } from '@matrix/client'
import { Visibility } from 'matrix-js-sdk'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

export const useDocsStore = defineStore('docs', () => {
  const documents = shallowRef<DocEntry[]>([])
  const activeSection = shallowRef<DocSectionId>('recent')
  const activeFolder = shallowRef('全部文档')
  const searchQuery = shallowRef('')
  const reviewOnly = shallowRef(false)
  const isLoading = shallowRef(false)

  const filteredDocuments = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    return documents.value.filter((doc) => {
      const matchesQuery = !query
        || doc.title.toLowerCase().includes(query)
        || doc.owner.toLowerCase().includes(query)
      const matchesSection = doc.sectionIds.includes(activeSection.value)
      const matchesFolder = activeFolder.value === '全部文档'
        || doc.folder === activeFolder.value
      const matchesReview = !reviewOnly.value || doc.status === '评审中'
      return matchesSection && matchesFolder && matchesQuery && matchesReview
    })
  })

  async function loadDocuments(): Promise<void> {
    isLoading.value = true
    try {
      const client = getClient()
      const rooms = client.getRooms()
      const docRooms = rooms.filter((r) => {
        const events = r.getLiveTimeline().getEvents()
        return events.some(e => e.getType() === 'org.muon.doc.metadata')
      })

      documents.value = docRooms.map((room) => {
        const metaEvent = room.getLiveTimeline().getEvents().find(e => e.getType() === 'org.muon.doc.metadata')
        const content = metaEvent?.getContent() || {}
        return {
          id: room.roomId,
          title: content.title || '无标题文档',
          owner: content.owner || '未知',
          updated: content.updated || '',
          type: content.type || '文档',
          status: content.status || '草稿',
          folder: content.folder || '全部文档',
          sectionIds: content.sectionIds || ['recent'],
        }
      })
    }
    catch {
      documents.value = []
    }
    finally {
      isLoading.value = false
    }
  }

  async function createDocument(title: string, folder: string): Promise<string> {
    const client = getClient()
    const result = await client.createRoom({
      name: title,
      visibility: Visibility.Private,
      initial_state: [{
        type: 'org.muon.doc.metadata',
        content: {
          title,
          owner: client.getUserId()!,
          updated: '刚刚',
          type: '文档',
          status: '草稿',
          folder,
          sectionIds: ['recent'],
          createdAt: Date.now(),
        },
      }],
    })
    await loadDocuments()
    return result.room_id
  }

  return {
    documents,
    activeSection,
    activeFolder,
    searchQuery,
    reviewOnly,
    isLoading,
    filteredDocuments,
    loadDocuments,
    createDocument,
  }
})
