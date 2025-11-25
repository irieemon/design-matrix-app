import React, { useState, useCallback, useRef, useEffect } from 'react'
import { IdeaCard } from '../types'

// Optimistic update types
type OptimisticUpdate = {
  id: string
  type: 'create' | 'update' | 'delete' | 'move'
  originalData?: any
  optimisticData: any
  timestamp: number
  reverseOperation?: () => void
}

interface UseOptimisticUpdatesOptions {
  onSuccess?: (id: string, result: any) => void
  onError?: (id: string, error: any) => void
  onRevert?: (id: string, originalData: any) => void
}

export const useOptimisticUpdates = (
  baseData: IdeaCard[],
  setBaseData: React.Dispatch<React.SetStateAction<IdeaCard[]>>,
  options: UseOptimisticUpdatesOptions = {}
) => {
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, OptimisticUpdate>>(new Map())
  const [optimisticData, setOptimisticData] = useState<IdeaCard[]>(baseData)
  const updateTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const { onSuccess, onError, onRevert } = options

  // Sync optimistic data with base data when it changes
  useEffect(() => {
    console.log('📊 useOptimisticUpdates SYNC:', {
      baseDataLength: baseData.length,
      prevOptimisticLength: optimisticData.length,
      firstBaseId: baseData[0]?.id?.substring(0, 8),
      firstOptimisticId: optimisticData[0]?.id?.substring(0, 8)
    })
    setOptimisticData(baseData)
  }, [baseData])

  // Apply optimistic update immediately to UI
  const applyOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    setPendingUpdates(prev => new Map(prev).set(update.id, update))
    
    // Apply the optimistic change to the display data
    setOptimisticData(prevData => {
      switch (update.type) {
        case 'create':
          return [...prevData, update.optimisticData as IdeaCard]
        
        case 'update':
          return prevData.map(item => 
            item.id === update.optimisticData.id ? 
            { ...item, ...update.optimisticData } : 
            item
          )
        
        case 'delete':
          return prevData.filter(item => item.id !== update.optimisticData.id)
        
        case 'move':
          return prevData.map(item => 
            item.id === update.optimisticData.id ? 
            { ...item, x: update.optimisticData.x, y: update.optimisticData.y } : 
            item
          )
        
        default:
          return prevData
      }
    })

    // Set timeout to auto-revert if not confirmed
    const timeout = setTimeout(() => {
      revertUpdate(update.id)
    }, 10000) // 10 second timeout

    updateTimeouts.current.set(update.id, timeout)
  }, [])

  // Confirm an optimistic update (when backend succeeds)
  const confirmUpdate = useCallback((updateId: string, serverData?: any) => {
    const update = pendingUpdates.get(updateId)
    if (!update) return

    // Clear timeout
    const timeout = updateTimeouts.current.get(updateId)
    if (timeout) {
      clearTimeout(timeout)
      updateTimeouts.current.delete(updateId)
    }

    // Remove from pending
    setPendingUpdates(prev => {
      const newMap = new Map(prev)
      newMap.delete(updateId)
      return newMap
    })

    // Update base data with server response
    if (serverData) {
      setBaseData((prevData: IdeaCard[]): IdeaCard[] => {
        switch (update.type) {
          case 'create':
            return [...prevData, serverData]
          
          case 'update':
            return prevData.map((item: IdeaCard) => 
              item.id === serverData.id ? serverData : item
            )
          
          case 'delete':
            return prevData.filter((item: IdeaCard) => item.id !== update.optimisticData.id)
          
          case 'move':
            return prevData.map((item: IdeaCard) => 
              item.id === serverData.id ? 
              { ...item, x: serverData.x, y: serverData.y } : 
              item
            )
          
          default:
            return prevData
        }
      })

      // Sync optimistic data with confirmed server data
      setOptimisticData(prevData => {
        switch (update.type) {
          case 'create':
          case 'update':
          case 'move':
            return prevData.map(item => 
              item.id === serverData.id ? serverData : item
            )
          
          default:
            return prevData
        }
      })
    }

    onSuccess?.(updateId, serverData)
  }, [pendingUpdates, setBaseData, onSuccess])

  // Revert an optimistic update (when backend fails or timeout)
  const revertUpdate = useCallback((updateId: string) => {
    const update = pendingUpdates.get(updateId)
    if (!update) return

    // Clear timeout
    const timeout = updateTimeouts.current.get(updateId)
    if (timeout) {
      clearTimeout(timeout)
      updateTimeouts.current.delete(updateId)
    }

    // Remove from pending
    setPendingUpdates(prev => {
      const newMap = new Map(prev)
      newMap.delete(updateId)
      return newMap
    })

    // Revert optimistic data to original state
    setOptimisticData(prevData => {
      switch (update.type) {
        case 'create':
          return prevData.filter(item => item.id !== update.optimisticData.id)
        
        case 'update':
        case 'move':
          return prevData.map(item => 
            item.id === update.optimisticData.id ? 
            update.originalData : 
            item
          )
        
        case 'delete':
          return [...prevData, update.originalData]
        
        default:
          return prevData
      }
    })

    onRevert?.(updateId, update.originalData)
  }, [pendingUpdates, onRevert])

  // Handle update failure
  const handleUpdateFailure = useCallback((updateId: string, error: any) => {
    revertUpdate(updateId)
    onError?.(updateId, error)
  }, [revertUpdate, onError])

  // Optimistic idea creation
  const createIdeaOptimistic = useCallback((
    newIdea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>,
    actualCreateFunction: () => Promise<IdeaCard>
  ) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const optimisticIdea: IdeaCard = {
      ...newIdea,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const update: OptimisticUpdate = {
      id: tempId,
      type: 'create',
      optimisticData: optimisticIdea,
      timestamp: Date.now()
    }

    // Apply optimistic update immediately
    applyOptimisticUpdate(update)

    // Execute actual creation in background
    actualCreateFunction()
      .then(serverIdea => {
        confirmUpdate(tempId, serverIdea)
      })
      .catch(error => {
        handleUpdateFailure(tempId, error)
      })

    return tempId
  }, [applyOptimisticUpdate, confirmUpdate, handleUpdateFailure])

  // Optimistic idea update
  const updateIdeaOptimistic = useCallback((
    updatedIdea: IdeaCard,
    actualUpdateFunction: () => Promise<IdeaCard>
  ) => {
    const originalIdea = baseData.find(idea => idea.id === updatedIdea.id)
    if (!originalIdea) return null

    const updateId = `update_${updatedIdea.id}_${Date.now()}`
    const update: OptimisticUpdate = {
      id: updateId,
      type: 'update',
      originalData: originalIdea,
      optimisticData: { ...updatedIdea, updated_at: new Date().toISOString() },
      timestamp: Date.now()
    }

    // Apply optimistic update immediately
    applyOptimisticUpdate(update)

    // Execute actual update in background
    actualUpdateFunction()
      .then(serverIdea => {
        confirmUpdate(updateId, serverIdea)
      })
      .catch(error => {
        handleUpdateFailure(updateId, error)
      })

    return updateId
  }, [baseData, applyOptimisticUpdate, confirmUpdate, handleUpdateFailure])

  // Optimistic idea deletion
  const deleteIdeaOptimistic = useCallback((
    ideaId: string,
    actualDeleteFunction: () => Promise<boolean>
  ) => {
    const originalIdea = baseData.find(idea => idea.id === ideaId)
    if (!originalIdea) return null

    const updateId = `delete_${ideaId}_${Date.now()}`
    const update: OptimisticUpdate = {
      id: updateId,
      type: 'delete',
      originalData: originalIdea,
      optimisticData: { id: ideaId },
      timestamp: Date.now()
    }

    // Apply optimistic update immediately
    applyOptimisticUpdate(update)

    // Execute actual deletion in background
    actualDeleteFunction()
      .then(success => {
        if (success) {
          confirmUpdate(updateId)
        } else {
          handleUpdateFailure(updateId, new Error('Delete operation failed'))
        }
      })
      .catch(error => {
        handleUpdateFailure(updateId, error)
      })

    return updateId
  }, [baseData, applyOptimisticUpdate, confirmUpdate, handleUpdateFailure])

  // Optimistic idea move/drag
  const moveIdeaOptimistic = useCallback((
    ideaId: string,
    newPosition: { x: number; y: number },
    actualMoveFunction: () => Promise<IdeaCard>
  ) => {
    const originalIdea = baseData.find(idea => idea.id === ideaId)
    if (!originalIdea) return null

    const updateId = `move_${ideaId}_${Date.now()}`
    const update: OptimisticUpdate = {
      id: updateId,
      type: 'move',
      originalData: originalIdea,
      optimisticData: { 
        ...originalIdea, 
        ...newPosition, 
        updated_at: new Date().toISOString() 
      },
      timestamp: Date.now()
    }

    // Apply optimistic update immediately
    applyOptimisticUpdate(update)

    // Execute actual move in background
    actualMoveFunction()
      .then(serverIdea => {
        confirmUpdate(updateId, serverIdea)
      })
      .catch(error => {
        handleUpdateFailure(updateId, error)
      })

    return updateId
  }, [baseData, applyOptimisticUpdate, confirmUpdate, handleUpdateFailure])

  // Get current state info
  const getOptimisticState = useCallback(() => {
    return {
      data: optimisticData,
      hasPendingUpdates: pendingUpdates.size > 0,
      pendingCount: pendingUpdates.size,
      pendingUpdates: Array.from(pendingUpdates.values())
    }
  }, [optimisticData, pendingUpdates])

  return {
    optimisticData,
    createIdeaOptimistic,
    updateIdeaOptimistic,
    deleteIdeaOptimistic,
    moveIdeaOptimistic,
    confirmUpdate,
    revertUpdate,
    getOptimisticState
  }
}