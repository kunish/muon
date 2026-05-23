import { describe, expect, it } from 'vitest'
import { useMention } from '@/features/chat/composables/useMention'
import { useChatStore } from '@/features/chat/stores/chatStore'
import { useContactStore } from '@/features/contacts/stores/contactStore'

describe('useMention', () => {
  it('includes contacts outside the current room context', () => {
    const chatStore = useChatStore()
    const contactStore = useContactStore()

    chatStore.setCurrentRoom('!group_family:localhost')
    contactStore.contacts = [
      {
        userId: '@edward:localhost',
        displayName: '小伟',
        avatarUrl: 'mxc://localhost/avatar_edward',
        presence: 'offline',
      },
    ]

    const { filterMembers } = useMention()

    expect(filterMembers('小伟')).toEqual([
      {
        id: '@edward:localhost',
        label: '小伟',
        avatar: 'mxc://localhost/avatar_edward',
        isInCurrentRoom: false,
      },
    ])
  })

  it('marks current room members as present in context', () => {
    const chatStore = useChatStore()

    chatStore.setCurrentRoom('!group_family:localhost')

    const { filterMembers } = useMention()

    expect(filterMembers('小红')).toEqual([
      {
        id: '@alice:localhost',
        label: '小红',
        avatar: 'mxc://localhost/avatar_alice',
        isInCurrentRoom: true,
      },
    ])
  })
})
