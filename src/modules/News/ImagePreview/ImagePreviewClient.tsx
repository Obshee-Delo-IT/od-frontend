'use client';

import Image from 'next/image';
import { useState, ReactElement, cloneElement, isValidElement, ReactNode } from 'react';
import { Modal } from '@/shared/ui/components/Modal';
import css from './ImagePreview.module.css';

interface ImagePreviewClientProps {
  children: ReactNode;
}

interface ImgElementProps {
  src?: string;
  className?: string;
}

export const ImagePreviewClient = ({ children }: ImagePreviewClientProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  /**
   * The thumbnail that opened the lightbox, so closing puts focus back on it
   * instead of dropping the reader at the top of the document. State, not a ref:
   * it is read while rendering `<Modal>`, which `react-hooks/refs` rightly
   * forbids for a ref.
   */
  const [openedFrom, setOpenedFrom] = useState<HTMLElement | null>(null);

  const handleImageClick = (src: string, trigger: HTMLElement | null) => {
    setOpenedFrom(trigger);
    setSelectedImage(src);
  };

  const handleClose = () => {
    setSelectedImage(null);
  };

  const addClickHandlers = (element: ReactElement): ReactElement => {
    const props = element.props as ImgElementProps & { children?: ReactNode };

    if (element.type === 'img' && props.src) {
      return cloneElement(element, {
        onClick: (e: React.MouseEvent<HTMLElement>) => handleImageClick(props.src as string, e.currentTarget),
        className: `${props.className || ''} ${css.clickableImage}`,
        role: 'button',
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleImageClick(props.src as string, e.currentTarget);
          }
        },
      } as Record<string, unknown>);
    }

    if (props.children) {
      const processedChildren = Array.isArray(props.children)
        ? (props.children.map((child: unknown) =>
            isValidElement(child) ? addClickHandlers(child) : child
          ) as ReactNode)
        : isValidElement(props.children)
          ? addClickHandlers(props.children)
          : props.children;

      return cloneElement(
        element,
        {
          key: element.key,
        },
        processedChildren
      );
    }

    return element;
  };

  const processedChildren = Array.isArray(children)
    ? children.map((child: unknown) => (isValidElement(child) ? addClickHandlers(child) : child))
    : isValidElement(children)
      ? addClickHandlers(children)
      : children;

  return (
    <>
      {processedChildren}
      <Modal isOpen={!!selectedImage} onClose={handleClose} title="Просмотр изображения" restoreFocusTo={openedFrom}>
        {selectedImage && (
          <div className={css.imageWrapper}>
            <Image src={selectedImage} alt="" fill style={{ objectFit: 'contain' }} quality={80} />
          </div>
        )}
      </Modal>
    </>
  );
};
