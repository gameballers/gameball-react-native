import React from 'react';
import { Image, Modal, StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { createGameballInAppMessages } from '../../presentation/GameballInAppMessages';
import { ReactMessagePresenter } from '../../presentation/message-presenter';
import type { InAppMessage } from '../../models/message';

function messageOf(overrides: Partial<InAppMessage> = {}): InAppMessage {
  return {
    id: 'm1',
    type: 'modal',
    header: 'Header',
    body: 'Body',
    imageUrl: null,
    buttons: [],
    clickAction: null,
    autoDismissMs: null,
    orientation: 'any',
    dismissible: true,
    scrimDismisses: true,
    style: {},
    ...overrides,
  } as InAppMessage;
}

function mount(element: React.ReactElement): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

function unmount(tree: TestRenderer.ReactTestRenderer): void {
  act(() => {
    tree.unmount();
  });
}

function show(presenter: ReactMessagePresenter, message: InAppMessage): void {
  presenter.present(message, {
    onShown: () => {},
    onDismissed: () => {},
    onButtonPressed: () => {},
    onMessagePressed: () => {},
  });
}

describe('GameballInAppMessages', () => {
  it.each(['modal', 'fullscreen'] as const)(
    'lets the app keep every orientation while a %s is up',
    (type) => {
      const presenter = new ReactMessagePresenter({});
      const Host = createGameballInAppMessages(presenter);
      // Inside act: the host registers itself from an effect, and an effect does not run until
      // the render is committed. Outside it, the presenter would have no surface to draw on.
      const tree = mount(<Host />);

      act(() => {
        show(presenter, messageOf({ type }));
      });

      // React Native's Modal allows only portrait unless told otherwise, and imposes it on the
      // whole app: without this prop, showing a message rotates the customer's screen.
      const modal = tree.root.findByType(Modal);
      expect(modal.props.supportedOrientations).toEqual(
        expect.arrayContaining([
          'portrait',
          'landscape',
          'landscape-left',
          'landscape-right',
        ])
      );
      unmount(tree);
    }
  );

  it('draws a slide-up in place, with no Modal to take the screen', () => {
    const presenter = new ReactMessagePresenter({});
    const Host = createGameballInAppMessages(presenter);
    const tree = mount(<Host />);

    act(() => {
      show(presenter, messageOf({ type: 'slideup' }));
    });

    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    unmount(tree);
  });

  it("gives a modal's artwork a height, so it is not drawn as nothing", () => {
    // A React Native Image has no intrinsic size: given only a width it occupies no space and the
    // picture never appears. Every stacked modal drew as copy and buttons alone until this was
    // fixed, and nothing but a render can see it.
    jest
      .spyOn(Image, 'getSize')
      .mockImplementation((_uri, success) => success(1200, 800));
    const presenter = new ReactMessagePresenter({});
    const Host = createGameballInAppMessages(presenter);
    const tree = mount(<Host />);

    act(() => {
      show(
        presenter,
        messageOf({ imageUrl: 'https://example.test/art.png', header: 'H' })
      );
    });

    const image = tree.root.findByProps({ testID: 'gb-iam-image' });
    const style = StyleSheet.flatten(image.props.style) as {
      height?: number;
      aspectRatio?: number;
    };
    expect(style.height ?? style.aspectRatio).toBeGreaterThan(0);
    unmount(tree);
    jest.restoreAllMocks();
  });
});
