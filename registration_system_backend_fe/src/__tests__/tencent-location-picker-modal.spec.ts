import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TencentLocationPickerModal from '@/components/TencentLocationPickerModal.vue'

const mocks = vi.hoisted(() => ({
  getMapPreviewSettings: vi.fn(),
  searchActivityLocations: vi.fn(),
  resolveActivityLocation: vi.fn(),
  loadTencentMapSdk: vi.fn(),
  createTencentLatLng: vi.fn(
    (_: unknown, point: { latitude: number; longitude: number }) => point,
  ),
  extractTencentLatLng: vi.fn(
    (latLng: { latitude?: number; longitude?: number } | undefined | null) =>
      latLng?.latitude != null && latLng?.longitude != null
        ? { latitude: latLng.latitude, longitude: latLng.longitude }
        : null,
  ),
}))

vi.mock('@/services/system', () => ({
  getMapPreviewSettings: mocks.getMapPreviewSettings,
}))

vi.mock('@/services/activity', () => ({
  searchActivityLocations: mocks.searchActivityLocations,
  resolveActivityLocation: mocks.resolveActivityLocation,
}))

vi.mock('@/utils/tencent-map', () => ({
  loadTencentMapSdk: mocks.loadTencentMapSdk,
  createTencentLatLng: mocks.createTencentLatLng,
  extractTencentLatLng: mocks.extractTencentLatLng,
}))

class FakeMap {
  static latestInstance: FakeMap | null = null

  center: { latitude: number; longitude: number }
  handlers = new Map<string, (payload?: unknown) => void>()

  constructor(_: HTMLElement, options: { center: { latitude: number; longitude: number } }) {
    this.center = options.center
    FakeMap.latestInstance = this
  }

  on(eventName: string, handler: (payload?: unknown) => void) {
    this.handlers.set(eventName, handler)
  }

  setCenter(center: { latitude: number; longitude: number }) {
    this.center = center
  }

  getCenter() {
    return this.center
  }

  emit(eventName: string, payload?: unknown) {
    this.handlers.get(eventName)?.(payload)
  }
}

describe('TencentLocationPickerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    FakeMap.latestInstance = null
    mocks.getMapPreviewSettings.mockResolvedValue({
      selected_provider: 'tencent',
      tencent_map_key: 'test-key',
    })
    mocks.searchActivityLocations.mockResolvedValue([])
    mocks.resolveActivityLocation.mockResolvedValue({
      provider_place_id: 'poi-resolved',
      title: '腾讯滨海大厦',
      address: '深圳市南山区科技南一路',
      display_name: '腾讯滨海大厦 · 深圳市南山区科技南一路',
      latitude: '22.520263',
      longitude: '113.95313',
    })
    mocks.loadTencentMapSdk.mockResolvedValue({
      Map: FakeMap,
    })

    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }) as unknown as typeof HTMLDialogElement.prototype.showModal
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }) as unknown as typeof HTMLDialogElement.prototype.close
  })

  it('keeps the center pin visible while the map center changes', async () => {
    const wrapper = mount(TencentLocationPickerModal, {
      props: {
        open: false,
        locationTitle: '深圳湾体育中心',
        locationLatitude: 22.51848,
        locationLongitude: 113.949699,
      },
      attachTo: document.body,
    })

    await wrapper.setProps({ open: true })
    await flushPromises()

    const centerPin = wrapper.find('[data-testid="map-center-pin"]')
    expect(centerPin.exists()).toBe(true)

    FakeMap.latestInstance?.setCenter({ latitude: 22.520263, longitude: 113.95313 })
    FakeMap.latestInstance?.emit('dragend')
    await flushPromises()

    expect(wrapper.find('[data-testid="map-center-pin"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('纬度 22.520263')
    expect(wrapper.text()).toContain('经度 113.95313')
    expect(wrapper.text()).toContain('腾讯滨海大厦')
    wrapper.unmount()
  })
})
