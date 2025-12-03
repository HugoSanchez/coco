'use client'

import { useCallback, useEffect, useMemo, useReducer } from 'react'

type ClientFormMode = 'create' | 'edit'

interface ClientFormPersistenceState {
	isOpen: boolean
	mode: ClientFormMode
	editingClientId: string | null
}

type Action =
	| { type: 'OPEN_CREATE' }
	| { type: 'OPEN_EDIT'; clientId: string }
	| { type: 'CLOSE' }
	| { type: 'RESET' }

const INITIAL_STATE: ClientFormPersistenceState = {
	isOpen: false,
	mode: 'create',
	editingClientId: null
}

const SHEET_STORAGE_KEY = 'dashboard-client-form:sheets'
const CREATE_DRAFT_KEY = 'dashboard-client-form:draft:create'
const EDIT_DRAFT_PREFIX = 'dashboard-client-form:draft:edit:'

const reducer = (state: ClientFormPersistenceState, action: Action): ClientFormPersistenceState => {
	switch (action.type) {
		case 'OPEN_CREATE':
			return { isOpen: true, mode: 'create', editingClientId: null }
		case 'OPEN_EDIT':
			return { isOpen: true, mode: 'edit', editingClientId: action.clientId }
		case 'CLOSE':
		case 'RESET':
			return { ...INITIAL_STATE }
		default:
			return state
	}
}

const hydrateState = (): ClientFormPersistenceState => {
	if (typeof window === 'undefined') return INITIAL_STATE
	try {
		const raw = window.sessionStorage.getItem(SHEET_STORAGE_KEY)
		if (!raw) return INITIAL_STATE
		const parsed = JSON.parse(raw)
		if (typeof parsed !== 'object' || parsed === null) return INITIAL_STATE

		return {
			isOpen: Boolean(parsed.isOpen),
			mode: parsed.mode === 'edit' ? 'edit' : 'create',
			editingClientId: typeof parsed.editingClientId === 'string' ? parsed.editingClientId : null
		}
	} catch {
		return INITIAL_STATE
	}
}

const getDraftKey = (mode: ClientFormMode, editingClientId: string | null): string =>
	mode === 'edit' && editingClientId ? `${EDIT_DRAFT_PREFIX}${editingClientId}` : CREATE_DRAFT_KEY

/**
 * Form data structure that matches ClientFormFields state
 */
export interface ClientFormDraft {
	name: string
	lastName: string
	email: string
	description: string
	phone: string
	nationalId: string
	dateOfBirth: string
	address: string
	shouldBill: boolean
	billingAmount: string
	paymentEmailLeadHours: string
	billingType: 'in-advance' | 'right-after' | 'monthly'
	applyVat: boolean
	suppressEmail: string
	// Collapsible section states
	notesOpen?: boolean
	additionalFieldsOpen?: boolean
	billingOpen?: boolean
	// Scroll position
	scrollPosition?: number
}

export function useClientFormPersistence() {
	const [state, dispatch] = useReducer(reducer, INITIAL_STATE, hydrateState)

	// Persist state to sessionStorage whenever it changes
	useEffect(() => {
		if (typeof window === 'undefined') return
		if (!state.isOpen && state.mode === 'create' && !state.editingClientId) {
			window.sessionStorage.removeItem(SHEET_STORAGE_KEY)
			return
		}
		window.sessionStorage.setItem(SHEET_STORAGE_KEY, JSON.stringify(state))
	}, [state])

	// Re-hydrate from sessionStorage when page becomes visible again
	// This handles the case where user switches tabs and comes back
	useEffect(() => {
		if (typeof window === 'undefined') return

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				const hydrated = hydrateState()
				// Check current state by reading from reducer's current value
				// We'll dispatch actions based on what's in storage vs what should be
				if (hydrated.isOpen) {
					// Storage says sheet should be open - ensure it is
					if (hydrated.mode === 'edit' && hydrated.editingClientId) {
						dispatch({ type: 'OPEN_EDIT', clientId: hydrated.editingClientId })
					} else {
						dispatch({ type: 'OPEN_CREATE' })
					}
				}
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, []) // Set up listener once on mount

	const openCreateForm = useCallback(() => {
		dispatch({ type: 'OPEN_CREATE' })
	}, [])

	const openEditForm = useCallback((clientId: string) => {
		if (!clientId) return
		dispatch({ type: 'OPEN_EDIT', clientId })
	}, [])

	const closeForm = useCallback(() => {
		dispatch({ type: 'CLOSE' })
	}, [])

	const resetFormState = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	const draftStorageKey = useMemo(
		() => getDraftKey(state.mode, state.editingClientId),
		[state.mode, state.editingClientId]
	)

	const clearPersistedDraft = useCallback(() => {
		if (typeof window === 'undefined') return
		window.sessionStorage.removeItem(draftStorageKey)
	}, [draftStorageKey])

	const saveDraft = useCallback(
		(draft: ClientFormDraft) => {
			if (typeof window === 'undefined') return
			try {
				window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draft))
			} catch (error) {
				console.error('Failed to save draft to sessionStorage:', error)
			}
		},
		[draftStorageKey]
	)

	const loadDraft = useCallback((): ClientFormDraft | null => {
		if (typeof window === 'undefined') return null
		try {
			const raw = window.sessionStorage.getItem(draftStorageKey)
			if (!raw) return null
			const parsed = JSON.parse(raw)
			// Validate that it has the expected structure
			if (typeof parsed === 'object' && parsed !== null && typeof parsed.name === 'string') {
				return parsed as ClientFormDraft
			}
			return null
		} catch {
			return null
		}
	}, [draftStorageKey])

	const persistKey = useMemo(() => {
		if (!state.isOpen) return null
		return draftStorageKey
	}, [state.isOpen, draftStorageKey])

	return {
		state,
		persistKey,
		openCreateForm,
		openEditForm,
		closeForm,
		resetFormState,
		clearPersistedDraft,
		saveDraft,
		loadDraft
	}
}

